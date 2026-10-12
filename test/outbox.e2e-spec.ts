import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';

// Requires the seed and a running RabbitMQ: docker compose up -d rabbitmq
describe('Order events via the outbox (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'StrongPass1';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, firstName: 'Ada', lastName: 'Lovelace', password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const placeOrder = (body: object) =>
    request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

  const eventsFor = (orderId: string) =>
    prisma.outboxEvent.findMany({
      where: { payload: { path: ['orderId'], equals: orderId } },
    });

  it('a FILLED order writes one order.filled event in the same transaction', async () => {
    const order = await placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 2,
    });

    const events = await eventsFor(order.body.id);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('order.filled');
    expect(events[0].payload).toMatchObject({
      orderId: order.body.id,
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 2,
      price: order.body.price,
    });
  });

  it('a REJECTED order writes no event', async () => {
    const order = await placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1_000_000,
    });

    expect(order.body.status).toBe('REJECTED');
    expect(await eventsFor(order.body.id)).toHaveLength(0);
  });

  it('the relay publishes the event to RabbitMQ within a few seconds', async () => {
    const order = await placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
    });

    // The relay polls every second; give it up to 10s
    let publishedAt: Date | null = null;
    for (let i = 0; i < 20 && !publishedAt; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      [{ publishedAt }] = await eventsFor(order.body.id);
    }

    expect(publishedAt).not.toBeNull();
  });
});

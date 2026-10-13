import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { WebSocket } from 'ws';
import { AppModule } from './../src/app.module.js';
import type { Quote } from './../src/market-data/market-data.types.js';
import { PriceFeed } from './../src/market-data/price-feed.service.js';

type Message = { event: string; data: any };

// A real WebSocket client against the real app (+ PostgreSQL and RabbitMQ
// for the order-fill push). Requires the seed.
describe('Realtime WebSocket (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  let priceFeed: PriceFeed;
  const sockets: WebSocket[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // main.ts does this for the real server; tests don't run main.ts
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    const { port } = (
      app.getHttpServer() as unknown as Server
    ).address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/ws`;
    priceFeed = app.get(PriceFeed);
  });

  afterEach(() => {
    sockets.forEach((socket) => socket.close());
    sockets.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  // Opens a connection that records every message it receives
  const connect = async () => {
    const socket = new WebSocket(url);
    sockets.push(socket);
    const received: Message[] = [];
    socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const send = (event: string, data: unknown) =>
      socket.send(JSON.stringify({ event, data }));

    // Resolves with the first message matching `match` (already received or not)
    const next = (match: (m: Message) => boolean, timeoutMs = 5_000) =>
      new Promise<Message>((resolve, reject) => {
        const started = Date.now();
        const check = () => {
          const found = received.find(match);
          if (found) return resolve(found);
          if (Date.now() - started > timeoutMs) {
            return reject(new Error(`No matching message in ${timeoutMs}ms`));
          }
          setTimeout(check, 20);
        };
        check();
      });

    return { socket, send, next, received };
  };

  const quote = (symbol: string, price: number): Quote => ({
    symbol,
    price,
    previousClose: price - 1,
    change: 1,
    changePercent: 0.5,
    timestamp: new Date().toISOString(),
  });

  it('subscribes to symbols, case-insensitively', async () => {
    const client = await connect();

    client.send('subscribe', { symbols: ['aapl', 'MSFT'] });

    const reply = await client.next((m) => m.event === 'subscribed');
    expect(reply.data.symbols.sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('pushes quotes only for the subscribed symbols', async () => {
    const client = await connect();
    client.send('subscribe', { symbols: ['AAPL'] });
    await client.next((m) => m.event === 'subscribed');

    priceFeed.publish(quote('NVDA', 123.45)); // not subscribed
    priceFeed.publish(quote('AAPL', 201.23));

    const pushed = await client.next(
      (m) => m.event === 'quote' && m.data.price === 201.23,
    );
    expect(pushed.data.symbol).toBe('AAPL');
    expect(client.received.some((m) => m.data?.symbol === 'NVDA')).toBe(false);
  });

  it('sends the latest quote right away to a new subscriber', async () => {
    priceFeed.publish(quote('GOOGL', 171.11));
    const client = await connect();

    client.send('subscribe', { symbols: ['GOOGL'] });

    const snapshot = await client.next((m) => m.event === 'quote');
    expect(snapshot.data).toMatchObject({ symbol: 'GOOGL', price: 171.11 });
  });

  it('stops pushing after unsubscribe', async () => {
    const client = await connect();
    client.send('subscribe', { symbols: ['TSLA'] });
    await client.next((m) => m.event === 'subscribed');
    client.send('unsubscribe', { symbols: ['TSLA'] });
    await client.next(
      (m) => m.event === 'subscribed' && m.data.symbols.length === 0,
    );

    priceFeed.publish(quote('TSLA', 250.5));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(
      client.received.some(
        (m) => m.event === 'quote' && m.data.price === 250.5,
      ),
    ).toBe(false);
  });

  it.each([
    ['an unknown symbol', { symbols: ['ZZZZ'] }, 'Unknown symbol(s): ZZZZ'],
    [
      'a malformed payload',
      { symbols: 'AAPL' },
      'Expected { symbols: string[] }',
    ],
  ])('answers %s with an exception event', async (_, data, message) => {
    const client = await connect();

    client.send('subscribe', data);

    // Nest's format for a WsException: { event: 'exception', data: { status, message } }
    const error = await client.next((m) => m.event === 'exception');
    expect(error.data.message).toBe(message);
  });

  it('refuses an invalid token', async () => {
    const client = await connect();

    client.send('auth', { token: 'not-a-jwt' });

    // Nest's format for a WsException: { event: 'exception', data: { status, message } }
    const error = await client.next((m) => m.event === 'exception');
    expect(error.data.message).toBe('Invalid or expired token');
  });

  it('pushes my order fill to me (order -> outbox -> RabbitMQ -> socket), not to others', async () => {
    const signUp = async () => {
      const email = `e2e-ws-${randomUUID()}@example.com`;
      const password = 'StrongPass1';
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, firstName: 'Web', lastName: 'Socket', password })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return login.body.accessToken as string;
    };
    const [token, otherToken] = await Promise.all([signUp(), signUp()]);

    const me = await connect();
    me.send('auth', { token });
    await me.next((m) => m.event === 'authenticated');
    const other = await connect();
    other.send('auth', { token: otherToken });
    await other.next((m) => m.event === 'authenticated');

    const order = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', side: 'BUY', quantity: 1 })
      .expect(201);

    // The outbox relay runs every second, then RabbitMQ delivers
    const pushed = await me.next(
      (m) => m.event === 'order' && m.data.orderId === order.body.id,
      15_000,
    );
    expect(pushed.data).toMatchObject({
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
    });
    expect(other.received.some((m) => m.event === 'order')).toBe(false);
  });
});

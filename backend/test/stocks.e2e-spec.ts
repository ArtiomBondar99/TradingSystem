import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// Requires the seed: npx prisma db seed
describe('Stocks (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /stocks lists the seeded stocks without a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/stocks')
      .expect(200);

    const symbols = response.body.map((s: { symbol: string }) => s.symbol);
    expect(symbols).toEqual(
      expect.arrayContaining(['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL']),
    );
  });

  it('GET /stocks/:symbol is case-insensitive', async () => {
    const response = await request(app.getHttpServer())
      .get('/stocks/aapl')
      .expect(200);

    expect(response.body.symbol).toBe('AAPL');
    expect(response.body.currentPrice).toMatch(/^\d+\.\d{2}$/);
  });

  it('GET /stocks/:symbol returns 404 for an unknown stock', async () => {
    await request(app.getHttpServer()).get('/stocks/ZZZZ').expect(404);
  });

  it('GET /stocks/:symbol returns 400 for an invalid symbol', async () => {
    await request(app.getHttpServer()).get('/stocks/AAPL123').expect(400);
  });
});

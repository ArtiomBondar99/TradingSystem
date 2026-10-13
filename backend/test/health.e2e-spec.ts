import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health returns status ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
    expect(response.body.environment).toBeDefined();
  });

  it('adds an X-Request-Id header to every response', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});

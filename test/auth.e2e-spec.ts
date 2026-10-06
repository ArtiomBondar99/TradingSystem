import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Auth (e2e)', () => {
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

  describe('POST /auth/register', () => {
    // A unique email per run, so tests don't collide with existing data
    const email = `e2e-${randomUUID()}@example.com`;

    it('creates a user and returns 201 without the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'StrongPass1' })
        .expect(201);

      expect(response.body.email).toBe(email);
      expect(response.body.id).toBeDefined();
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'StrongPass1' })
        .expect(409);
    });

    it('returns 400 for an invalid body', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });
});

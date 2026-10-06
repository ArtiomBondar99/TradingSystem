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

  describe('login and protected routes', () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'StrongPass1';
    let accessToken: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);
    });

    it('POST /auth/login returns 200 with a bearer token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body.tokenType).toBe('Bearer');
      expect(typeof response.body.accessToken).toBe('string');
      accessToken = response.body.accessToken;
    });

    it('POST /auth/login returns 401 for a wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'WrongPass1' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('GET /users/me returns the profile for a valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(email);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('GET /users/me returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('GET /users/me returns 401 for a tampered token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}tampered`)
        .expect(401);
    });
  });
});

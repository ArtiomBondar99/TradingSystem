import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Rate limiting is off in tests (they create many users per minute), so this
// file turns it back on. It must be set BEFORE the app's config is loaded,
// hence the dynamic imports below instead of static ones.
// Requires Redis: docker compose up -d redis
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    const { AppModule } = await import('./../src/app.module.js');
    const { REDIS_CLIENT } = await import('./../src/cache/cache.service.js');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    // The connection opens asynchronously. Until it's ready the guard fails
    // open (by design), which would make this test pass for the wrong reason.
    const redis = app.get<Redis>(REDIS_CLIENT);
    if (redis.status !== 'ready') {
      await new Promise((resolve) => redis.once('ready', resolve));
    }

    // Start from zero: counters from an earlier run may still be in Redis
    const keys = await redis.keys('rate-limit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    delete process.env.RATE_LIMIT_ENABLED;
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPass1' });

  it('blocks the 6th login attempt in a minute with 429', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login().expect(401);
    }

    const blocked = await login().expect(429);

    expect(blocked.body.message).toMatch(/Too many requests/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('counts each route separately: other routes still work', async () => {
    await request(app.getHttpServer()).get('/stocks').expect(200);
  });

  it('never limits /health', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

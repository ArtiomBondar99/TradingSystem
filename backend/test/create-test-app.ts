import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import type { App } from 'supertest/types.js';

// Tests don't run main.ts, so the parts of its setup the app can't start
// without are repeated here, once, for every e2e file. Without the WebSocket
// adapter, Nest looks for socket.io (not installed) and exits.
export function createTestApp(
  moduleFixture: TestingModule,
): INestApplication<App> {
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.useWebSocketAdapter(new WsAdapter(app));
  return app;
}

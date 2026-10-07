import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // bufferLogs: hold startup logs until the Pino logger is ready, so every
  // line (including Nest's own) comes out in the same structured format
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // bufferLogs: hold startup logs until the Pino logger is ready, so every
  // line (including Nest's own) comes out in the same structured format
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // On SIGTERM (docker stop, a deploy), run every onModuleDestroy before
  // exiting: finish the outbox batch, close RabbitMQ, Redis and Postgres
  app.enableShutdownHooks();

  // Interactive API docs at /docs (raw OpenAPI JSON at /docs-json).
  // Request/response schemas come from the DTOs, via the Swagger CLI plugin
  // in nest-cli.json.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Paper Trading API')
    .setDescription(
      'Trade stocks with virtual money. Register, log in, then click ' +
        '"Authorize" and paste the accessToken.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    // Keep the token after a page refresh
    { swaggerOptions: { persistAuthorization: true } },
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

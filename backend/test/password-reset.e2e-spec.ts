import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { FORGOT_PASSWORD_MESSAGE } from '../src/auth/auth.controller.js';
import { hashResetToken } from '../src/auth/password-reset.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MailService, type MailMessage } from '../src/mail/mail.service.js';
import { createTestApp } from './create-test-app.js';

const RESET_SUBJECT = 'Reset your PaperTrade password';
const CHANGED_SUBJECT = 'Your PaperTrade password was changed';

describe('Password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Instead of SMTP: every mail the app sends lands in this array
  const sent: MailMessage[] = [];
  const fakeMail = {
    send: (message: MailMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
    onModuleDestroy: () => undefined,
  };

  const mailsTo = (to: string, subject = RESET_SUBJECT) =>
    sent.filter((mail) => mail.to === to && mail.subject === subject);

  // The link is sent in the background, after the response: wait for it
  async function waitForMails(
    to: string,
    count = 1,
    subject = RESET_SUBJECT,
  ): Promise<MailMessage[]> {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (mailsTo(to, subject).length >= count) {
        return mailsTo(to, subject);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Expected ${count} "${subject}" mail(s) to ${to}`);
  }

  const tokenIn = (mail: MailMessage) => {
    const token = /reset-password\?token=([\w-]+)/.exec(mail.text)?.[1];
    if (!token) throw new Error('No reset link in the mail');
    return token;
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  async function registerUser(password = 'OldStrongPass1'): Promise<string> {
    const email = `e2e-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, firstName: 'Ada', lastName: 'Lovelace', password })
      .expect(201);
    return email;
  }

  const forgot = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email });

  const reset = (token: string, password = 'NewStrongPass1') =>
    request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password });

  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });

  async function requestLink(email: string): Promise<string> {
    await forgot(email).expect(202);
    const [mail] = await waitForMails(email);
    return tokenIn(mail);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    app = createTestApp(moduleFixture);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the same for a registered and an unknown email', async () => {
    const email = await registerUser();
    const unknown = `nobody-${randomUUID()}@example.com`;

    const registered = await forgot(email).expect(202);
    const notRegistered = await forgot(unknown).expect(202);

    expect(registered.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(notRegistered.body).toEqual(registered.body);
    await waitForMails(email);
    await settle();
    expect(mailsTo(unknown)).toHaveLength(0);
  });

  it('finds the account whatever the case and spaces of the email', async () => {
    const email = await registerUser();

    await forgot(`  ${email.toUpperCase()} `).expect(202);

    await waitForMails(email);
  });

  it('changes the password with the emailed link, once', async () => {
    const email = await registerUser('OldStrongPass1');
    const token = await requestLink(email);

    // Only the hash is in the database, never the token itself
    const rows = await prisma.passwordResetToken.findMany({
      where: { user: { email } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashResetToken(token));

    await reset(token, 'NewStrongPass1').expect(204);

    await login(email, 'NewStrongPass1').expect(200);
    await login(email, 'OldStrongPass1').expect(401);
    // The owner is told, in case it wasn't them
    await waitForMails(email, 1, CHANGED_SUBJECT);

    // The same link again: already used
    const again = await reset(token, 'ThirdStrongPass1').expect(400);
    expect(again.body.message).toBe(
      'This reset link is invalid or has expired. Request a new one.',
    );
    await login(email, 'NewStrongPass1').expect(200);
  });

  it('rejects an expired link and keeps the old password', async () => {
    const email = await registerUser('OldStrongPass1');
    const token = await requestLink(email);
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash: hashResetToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await reset(token).expect(400);

    await login(email, 'OldStrongPass1').expect(200);
  });

  it('rejects a made-up token', async () => {
    await reset('x'.repeat(43)).expect(400);
  });

  it('sends one mail a minute at most per account', async () => {
    const email = await registerUser();

    await forgot(email).expect(202);
    await waitForMails(email);
    await forgot(email).expect(202);
    await settle();

    expect(mailsTo(email)).toHaveLength(1);
  });

  it('only the newest link works', async () => {
    const email = await registerUser();
    const first = await requestLink(email);
    // Pretend the first one is 2 minutes old: past the cooldown
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash: hashResetToken(first) },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });

    await forgot(email).expect(202);
    const second = tokenIn((await waitForMails(email, 2))[1]);

    await reset(first).expect(400);
    await reset(second).expect(204);
  });

  it('lets only one of several simultaneous requests use a link', async () => {
    const email = await registerUser();
    const token = await requestLink(email);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => reset(token, `ParallelPass${i}`)),
    );

    const statuses = responses
      .map((response) => response.status)
      .sort((a, b) => a - b);
    expect(statuses).toEqual([204, 400, 400, 400, 400]);
  });

  it.each([
    ['an invalid email', '/auth/forgot-password', { email: 'not-an-email' }],
    ['a short password', '/auth/reset-password', { token: 'abc', password: 'short' }],
    ['a missing token', '/auth/reset-password', { password: 'NewStrongPass1' }],
  ])('returns 400 for %s', async (_case, path, body) => {
    await request(app.getHttpServer()).post(path).send(body).expect(400);
  });
});

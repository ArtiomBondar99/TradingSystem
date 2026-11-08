import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service.js';

@Module({
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      // createTransport doesn't connect yet: the SMTP connection is opened
      // per message, so the app starts fine even if the server is down
      useFactory: (config: ConfigService) =>
        new MailService(
          createTransport(config.getOrThrow<string>('mail.smtpUrl')),
          config.getOrThrow<string>('mail.from'),
        ),
    },
  ],
  exports: [MailService],
})
export class MailModule {}

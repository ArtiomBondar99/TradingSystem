import { Logger, type OnModuleDestroy } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  // Both: mail apps that block HTML (or a screen reader) show the text part
  text: string;
  html: string;
}

// The only part of a nodemailer transporter we use. Depending on this small
// interface (not on nodemailer) lets the tests pass a fake that sends nothing.
export interface MailTransport {
  sendMail(message: MailMessage & { from: string }): Promise<unknown>;
  close(): void;
}

// Created in mail.module.ts with the SMTP server from config: Mailpit in
// development, a real provider (e.g. Amazon SES) in production. Same code.
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
  ) {}

  /** Throws if the SMTP server refuses or can't be reached: the caller decides */
  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
    // No recipient in the log: an email address is personal data
    this.logger.log({
      action: 'mail.sent',
      subject: message.subject,
      msg: 'Mail sent',
    });
  }

  // Graceful shutdown: close the SMTP connection
  onModuleDestroy(): void {
    this.transport.close();
  }
}

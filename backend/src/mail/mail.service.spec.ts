import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { MailService, type MailTransport } from './mail.service.js';

describe('MailService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  const message = {
    to: 'dana@example.com',
    subject: 'Reset your password',
    text: 'Open this link',
    html: '<p>Open this link</p>',
  };

  function setup(sendMail = jest.fn<MailTransport['sendMail']>()) {
    sendMail.mockResolvedValue({});
    const transport = { sendMail, close: jest.fn() };
    return {
      transport,
      mail: new MailService(transport, 'Paper Trading <no-reply@test.local>'),
    };
  }

  it('sends the message from the configured address', async () => {
    const { mail, transport } = setup();

    await mail.send(message);

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'Paper Trading <no-reply@test.local>',
      ...message,
    });
  });

  it('lets the caller see a failure (the SMTP server is down)', async () => {
    const sendMail = jest.fn<MailTransport['sendMail']>();
    const { mail } = setup(sendMail);
    sendMail.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(mail.send(message)).rejects.toThrow('ECONNREFUSED');
  });

  it('closes the connection on shutdown', () => {
    const { mail, transport } = setup();

    mail.onModuleDestroy();

    expect(transport.close).toHaveBeenCalled();
  });
});

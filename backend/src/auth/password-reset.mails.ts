import type { MailMessage } from '../mail/mail.service.js';

// The user picks their own first name: inserted into HTML unescaped, a name
// like "<a href=...>" would put the attacker's markup into our email
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function resetLinkMail(
  to: string,
  firstName: string,
  link: string,
  validMinutes: number,
): MailMessage {
  const name = escapeHtml(firstName);
  return {
    to,
    subject: 'Reset your PaperTrade password',
    text: [
      `Hi ${firstName},`,
      '',
      'Someone (hopefully you) asked to reset the password of your PaperTrade account.',
      `Open this link to choose a new one. It works once, for ${validMinutes} minutes:`,
      '',
      link,
      '',
      "If you didn't ask for this, ignore this email: your password stays the same.",
    ].join('\n'),
    html: `<p>Hi ${name},</p>
<p>Someone (hopefully you) asked to reset the password of your PaperTrade account.</p>
<p><a href="${link}">Choose a new password</a></p>
<p>The link works once, for ${validMinutes} minutes.</p>
<p>If you didn't ask for this, ignore this email: your password stays the same.</p>`,
  };
}

// Sent after a reset: if it wasn't the owner, they find out right away
export function passwordChangedMail(to: string, firstName: string): MailMessage {
  const name = escapeHtml(firstName);
  return {
    to,
    subject: 'Your PaperTrade password was changed',
    text: [
      `Hi ${firstName},`,
      '',
      'The password of your PaperTrade account was just changed.',
      "If this wasn't you, reset it again right away from the login page.",
    ].join('\n'),
    html: `<p>Hi ${name},</p>
<p>The password of your PaperTrade account was just changed.</p>
<p>If this wasn't you, reset it again right away from the login page.</p>`,
  };
}

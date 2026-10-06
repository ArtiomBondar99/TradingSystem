import { PasswordHasher } from './password-hasher.service.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces an argon2id hash that differs from the password', async () => {
    const hash = await hasher.hash('StrongPass1');

    expect(hash).not.toBe('StrongPass1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time (random salt)', async () => {
    const first = await hasher.hash('StrongPass1');
    const second = await hasher.hash('StrongPass1');

    expect(first).not.toBe(second);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hasher.hash('StrongPass1');

    await expect(hasher.verify(hash, 'StrongPass1')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'WrongPass1')).resolves.toBe(false);
  });
});

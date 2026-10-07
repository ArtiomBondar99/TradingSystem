import { jest } from '@jest/globals';
import { PasswordHasher } from './password-hasher.service.js';

// Argon2 is slow and memory-hungry ON PURPOSE (that's what makes brute force
// expensive). ~0.3s alone, but much slower when Jest runs many test files in
// parallel, so the default 5s timeout is too tight for this suite.
jest.setTimeout(30_000);

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();
  let hash: string;

  // Hash once and reuse it, instead of 4 separate hashes across the tests
  beforeAll(async () => {
    hash = await hasher.hash('StrongPass1');
  });

  it('produces an argon2id hash that differs from the password', () => {
    expect(hash).not.toBe('StrongPass1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time (random salt)', async () => {
    const second = await hasher.hash('StrongPass1');

    expect(second).not.toBe(hash);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    await expect(hasher.verify(hash, 'StrongPass1')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'WrongPass1')).resolves.toBe(false);
  });
});

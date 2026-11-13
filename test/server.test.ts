// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createUserHash } from '../src/server';

// The test vector published in https://github.com/Replyze/replyze (Identity verification).
const SECRET = 'f3a1c9e07b2d4e68a5c1d9b3e7f20486a9c3e5d7f1b3a5c7e9d1f3b5a7c9e1d3';

describe('createUserHash', () => {
  it('matches the published test vector for a user id', async () => {
    expect(await createUserHash(SECRET, { user_id: '42' })).toBe('61b4b465a57ec25065d5a3b377329c00ab8e1c5562756729d26d880f39d8ec13');
  });

  it('matches the published test vector for an email (no id): trimmed and lower case', async () => {
    expect(await createUserHash(SECRET, { email: ' Jane@Example.com ' })).toBe('74baeda7d2f63e1df51c7aeea059bcf644fdca57ec0fcaba9a0f7b0e1b5eaaf9');
  });

  it('signs the id, not the email, when there are both; numbers and strings are the same', async () => {
    const byId = await createUserHash(SECRET, { user_id: '42' });
    expect(await createUserHash(SECRET, { user_id: 42, email: 'jane@example.com' })).toBe(byId);
    expect(await createUserHash(SECRET, { user_id: ' 42 ' })).toBe(byId);
  });

  it('falls back to the email when the id is empty', async () => {
    expect(await createUserHash(SECRET, { user_id: '  ', email: 'jane@example.com' })).toBe(
      await createUserHash(SECRET, { email: 'jane@example.com' }),
    );
  });

  it('is the same as PHP hash_hmac / Node createHmac over the subject', async () => {
    const expected = createHmac('sha256', SECRET).update('user-9f2c').digest('hex');
    expect(await createUserHash(SECRET, { user_id: 'user-9f2c' })).toBe(expected);
  });

  it('refuses an empty secret or a user with nothing to sign', async () => {
    await expect(createUserHash('', { user_id: 1 })).rejects.toThrow(/secret is empty/);
    await expect(createUserHash(SECRET, {})).rejects.toThrow(/user_id or an email/);
    await expect(createUserHash(SECRET, { email: '  ' })).rejects.toThrow(/user_id or an email/);
  });
});

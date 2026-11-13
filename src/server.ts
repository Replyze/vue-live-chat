/**
 * Server-side helpers. Import from `@replyze/vue/server` in server code
 * only: Nuxt server routes (server/api), Nitro, Express, serverless functions.
 * The identity secret must never reach the browser.
 */
import { identitySubject } from './subject';

export interface ReplyzeUserToSign {
  user_id?: string | number | null;
  email?: string | null;
}

const encoder = new TextEncoder();

/**
 * The `user_hash` for identity verification, exactly as the Replyze server
 * checks it: the hex HMAC-SHA256 of the user id (or, without one, of the
 * email in lower case), keyed with the identity secret from
 * Settings → Chat Widget → Identity.
 *
 * Uses Web Crypto only, so it runs in Node 20+, Nuxt server routes (Node and
 * edge presets), Bun, Deno and Cloudflare Workers.
 *
 * ```ts
 * const user_hash = await createUserHash(useRuntimeConfig(event).replyzeIdentitySecret, { user_id: user.id });
 * ```
 */
export async function createUserHash(secret: string, user: ReplyzeUserToSign): Promise<string> {
  if (typeof secret !== 'string' || secret === '') {
    throw new Error('createUserHash: the identity secret is empty. Copy it from Settings → Chat Widget → Identity into a server-side environment variable.');
  }
  const subject = identitySubject(user);
  if (subject === null) throw new Error('createUserHash: the user needs a user_id or an email.');

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('createUserHash: Web Crypto (globalThis.crypto.subtle) is not available. Use Node 20 or newer.');
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(subject)));
  let hex = '';
  for (let i = 0; i < signature.length; i++) hex += signature[i].toString(16).padStart(2, '0');
  return hex;
}

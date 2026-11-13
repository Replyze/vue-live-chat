import { createUserHash } from '@replyze/vue/server';
import type { ReplyzeIdentity } from '@replyze/vue';
import { getDemoUser } from '../utils/demo-user';

/**
 * Who is signed in, for the chat's `user` prop: `{ user: null }` when nobody
 * is, else the user signed with the identity secret (when it is set). The
 * secret stays on the server; only the hash goes to the browser.
 */
export default defineEventHandler(async (event): Promise<{ user: ReplyzeIdentity | null }> => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const user = getDemoUser(event); // your auth: { id, email, name } or null
  if (!user) return { user: null };

  const secret = useRuntimeConfig(event).replyzeIdentitySecret;
  return {
    user: {
      user_id: user.id,
      email: user.email,
      name: user.name,
      // Only with identity verification on: a user_hash while it is off is refused.
      user_hash: secret ? await createUserHash(secret, { user_id: user.id }) : undefined,
    },
  };
});

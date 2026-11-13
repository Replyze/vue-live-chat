import { DEMO_COOKIE } from '../utils/demo-user';

/** Demo sign-in: your auth does this for real. */
export default defineEventHandler((event) => {
  setCookie(event, DEMO_COOKIE, String(1000 + Math.floor(Math.random() * 9000)), { httpOnly: true, sameSite: 'lax', path: '/' });
  return { ok: true };
});

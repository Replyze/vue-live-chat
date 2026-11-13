import { DEMO_COOKIE } from '../utils/demo-user';

/** Demo sign-out. */
export default defineEventHandler((event) => {
  deleteCookie(event, DEMO_COOKIE, { path: '/' });
  return { ok: true };
});

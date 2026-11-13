/** A stand-in for your auth: the "signed-in user" is a cookie the buttons on the page set. */
export interface DemoUser {
  id: string;
  email: string;
  name: string;
}

export const DEMO_COOKIE = 'demo_user';

type Event = Parameters<typeof getCookie>[0];

export function getDemoUser(event: Event): DemoUser | null {
  const id = getCookie(event, DEMO_COOKIE);
  return id ? { id, email: `${id}@example.com`, name: `Demo user ${id}` } : null;
}

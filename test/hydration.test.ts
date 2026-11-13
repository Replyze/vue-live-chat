/**
 * A server-rendered page (Nuxt, or Vue SSR) hydrating in the browser: the
 * server rendered the idle state, and on the client the widget may already
 * be loading or running. The first client render must match the server's.
 */
import { createSSRApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Replyze, ReplyzeChat, useReplyze } from '../src';
import { deliverScript, newPage, startFakeWidget } from './support/fakeWidget';

const Status = defineComponent({
  setup() {
    const { status, isOpen, unreadCount } = useReplyze();
    return () => h('p', `${status.value} ${isOpen.value} ${unreadCount.value}`);
  },
});
const Root = defineComponent({
  render: () => [h(ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }), h(Status)],
});
// What the server renders for Root (see ssr.test.ts).
const SERVER_HTML = '<!--[--><!----><p>idle false 0</p><!--]-->';

let container: HTMLElement;
let unmount: (() => void) | null = null;

beforeEach(() => {
  newPage();
  container = document.createElement('div');
  container.innerHTML = SERVER_HTML;
  document.body.appendChild(container);
});
afterEach(() => unmount?.());

function hydrate(withPlugin: boolean) {
  const warn = vi.spyOn(console, 'warn');
  const error = vi.spyOn(console, 'error');
  const app = createSSRApp(Root);
  if (withPlugin) app.use(Replyze, { token: 'wgt_test', strategy: 'afterInteractive' });
  app.mount(container);
  unmount = () => app.unmount();
  const mismatches = [...warn.mock.calls, ...error.mock.calls].filter((args) => String(args[0]).includes('ydration'));
  return { mismatches };
}

it('hydrates without a mismatch while the widget is loading, then shows the live state', async () => {
  const { mismatches } = hydrate(true);
  expect(mismatches).toEqual([]);
  expect(container.textContent).toBe('idle false 0');
  await nextTick();
  expect(container.textContent).toBe('loading false 0');
  const widget = deliverScript()!;
  widget.receive('Hi');
  await nextTick();
  expect(container.textContent).toBe('ready false 1');
});

it('hydrates without a mismatch when a widget is already running', async () => {
  (window as unknown as { ReplyzeConfig: unknown }).ReplyzeConfig = { token: 'wgt_test' };
  const widget = startFakeWidget()!;
  const { mismatches } = hydrate(false);
  expect(mismatches).toEqual([]);
  await nextTick();
  expect(container.textContent).toBe('ready false 0');
  // From here on the state follows the widget's events.
  widget.open();
  await nextTick();
  expect(container.textContent).toBe('ready true 0');
});

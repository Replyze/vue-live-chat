/**
 * This package with the real widget: widget.js (the live one from
 * cdn.replyze.chat, or REPLYZE_WIDGET_JS) runs in jsdom when <ReplyzeChat>
 * or the plugin adds its script tag. Only the Replyze API is faked; nothing
 * reaches it.
 */
import fs from 'node:fs';
import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { Replyze, ReplyzeChat, useReplyze, type ReplyzeMethods, type UseReplyzeResult } from '../src';
import { newPage, widgetScripts } from './support/fakeWidget';

const bundle = fs.readFileSync(inject('widgetJs'), 'utf8');
const API = 'https://api.replyze.test';
const tick = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ApiCall {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

const CONFIG = {
  widget: { color: '#0e7490', bot_name: 'Ava', pre_chat_form: false },
  features: { home_tab: false, help_tab: false, search: false },
  ws: null,
};

function answer(url: string): unknown {
  if (url.endsWith('/config')) return CONFIG;
  if (url.endsWith('/session/start')) {
    return { session_id: '0', contact_id: '5', visitor_key: 'vk_5', channel_key: 'ck_5', messages: [], ...CONFIG };
  }
  if (url.endsWith('/identify')) {
    return { contact_id: '5', visitor_key: 'vk_5', channel_key: 'ck_5', email: 'ana@shop.example', name: 'Ana', verified: true, switched: false, form_data: [] };
  }
  return {};
}

let calls: ApiCall[] = [];
let state: UseReplyzeResult | null = null;
const Probe = defineComponent({
  setup() {
    state = useReplyze();
    return () => null;
  },
});

const wrappers: VueWrapper[] = [];
let app: App | null = null;
function render(props: Record<string, unknown>): VueWrapper {
  const Root = defineComponent({ render: () => [h(ReplyzeChat, { token: 'wgt_e2e', apiUrl: API, tracking: false, strategy: 'afterInteractive', ...props }), h(Probe)] });
  const wrapper = mount(Root, { attachTo: document.body });
  wrappers.push(wrapper);
  return wrapper;
}

/** What the browser does with the script tag the package added: run widget.js, fire load. */
function runWidgetScript(): void {
  const [script] = widgetScripts();
  expect(script).toBeTruthy();
  (0, eval)(bundle);
  script.dispatchEvent(new Event('load'));
}

function shadow(): ShadowRoot {
  const host = document.getElementById('aichat-widget');
  expect(host?.shadowRoot).toBeTruthy();
  return host!.shadowRoot!;
}

beforeAll(() => {
  // What jsdom doesn't draw.
  Element.prototype.scrollTo = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  newPage();
  calls = [];
  state = null;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ method, url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    if (!url.startsWith(API)) throw new Error(`Unexpected request to ${url}`);
    return new Response(JSON.stringify(answer(url)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  app?.unmount();
  app = null;
  (window as unknown as { Replyze?: { _widget?: { destroy(): void } } }).Replyze?._widget?.destroy();
});

describe('with the real widget.js', () => {
  it('has every method this package calls', async () => {
    render({});
    runWidgetScript();
    await tick();
    const api = (window as unknown as { Replyze: Record<string, unknown> }).Replyze;
    const ours = Object.keys(Replyze) as Array<keyof ReplyzeMethods>;
    expect([...ours].sort()).toEqual([
      'close', 'hide', 'identify', 'off', 'on', 'open', 'openArticle', 'pushEvent',
      'reset', 'sendMessage', 'setData', 'setLanguage', 'setTracking', 'setUser', 'show', 'toggle',
    ]);
    for (const method of ours) expect(typeof api[method], method).toBe('function');
    expect(api._initialized).toBe(true);
  });

  it('starts with the config from the props, runs early calls, and follows open/close/show/hide', async () => {
    const errors = vi.spyOn(console, 'error');
    const wrapper = render({ apiUrl: `${API}/`, language: 'de' });
    // Before the widget runs: the call waits.
    Replyze.open();
    expect(state!.status.value).toBe('loading');

    runWidgetScript();
    await tick();
    expect(state!.status.value).toBe('ready');

    // The early open() ran, after this package was listening.
    expect(state!.isOpen.value).toBe(true);
    expect(shadow().querySelector('.is-open')).toBeTruthy();

    // The config reached the widget: its API, its language, no tracking requests.
    expect(calls[0]).toMatchObject({ method: 'GET', url: `${API}/api/w/wgt_e2e/config` });
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(shadow().querySelector('[aria-label="Chat schließen"]')).toBeTruthy();

    Replyze.close();
    expect(state!.isOpen.value).toBe(false);
    expect(shadow().querySelector('.is-open')).toBeNull();

    Replyze.toggle();
    expect(state!.isOpen.value).toBe(true);
    Replyze.toggle();
    expect(state!.isOpen.value).toBe(false);

    const host = document.getElementById('aichat-widget')!;
    Replyze.hide();
    expect(host.style.getPropertyValue('display')).toBe('none');
    Replyze.show();
    expect(host.style.getPropertyValue('display')).toBe('block');

    Replyze.setLanguage('fr');
    expect(shadow().querySelector('[aria-label="Ouvrir le chat"]')).toBeTruthy();

    // The widget's events came out as Vue events of <ReplyzeChat>.
    await nextTick();
    const chat = wrapper.findComponent(ReplyzeChat);
    expect(chat.emitted().ready).toHaveLength(1);
    expect(chat.emitted().open).toHaveLength(2);
    expect(chat.emitted().close).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
  });

  it('identifies a verified user through the user prop and reports it (fake API)', async () => {
    const identified = vi.fn();
    Replyze.on('identified', identified);
    render({ user: { user_id: 42, email: 'ana@shop.example', name: 'Ana', user_hash: 'ab12' } });
    runWidgetScript();
    await tick(50);
    const identify = calls.find((c) => c.url.endsWith('/identify'));
    expect(identify?.body).toMatchObject({ user_id: '42', user_hash: 'ab12', email: 'ana@shop.example', name: 'Ana' });
    expect(identified).toHaveBeenCalledWith({ verified: true });
  });

  it('reset() reaches the widget and emits reset', async () => {
    const reset = vi.fn();
    render({});
    runWidgetScript();
    await tick();
    Replyze.on('reset', reset);
    Replyze.reset();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('loads through app.use(Replyze, options) too', async () => {
    app = createApp(Probe).use(Replyze, { token: 'wgt_plugin', apiUrl: API, tracking: false, botName: 'Ava', strategy: 'afterInteractive' });
    app.mount(document.body.appendChild(document.createElement('div')));
    Replyze.setData({ plan: 'pro' });
    runWidgetScript();
    await tick();
    expect(state!.status.value).toBe('ready');
    expect(calls[0]).toMatchObject({ method: 'GET', url: `${API}/api/w/wgt_plugin/config` });
    Replyze.open();
    expect(state!.isOpen.value).toBe(true);
  });
});

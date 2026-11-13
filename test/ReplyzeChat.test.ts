import { defineComponent, h, nextTick, type Component } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SCRIPT_URL, Replyze, ReplyzeChat, useReplyze, type ReplyzeChatProps, type UseReplyzeResult } from '../src';
import { deliverScript, failScript, newPage, startFakeWidget, widgetScripts, type FakeWidget } from './support/fakeWidget';

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  ReplyzeConfig?: Record<string, unknown>;
  Replyze?: Record<string, unknown>;
};
const w = window as IdleWindow;

/** requestIdleCallback under the test's control. */
let idleQueue: Array<() => void> = [];
function runIdle(): void {
  const run = idleQueue;
  idleQueue = [];
  run.forEach((cb) => cb());
}

function setReadyState(value: DocumentReadyState | null): void {
  if (value === null) delete (document as unknown as Record<string, unknown>).readyState;
  else Object.defineProperty(document, 'readyState', { configurable: true, get: () => value });
}

let lastState: UseReplyzeResult | null = null;
const StateProbe = defineComponent({
  setup() {
    lastState = useReplyze();
    return () => null;
  },
});

const wrappers: VueWrapper[] = [];
function render(...children: Array<[Component, Record<string, unknown>?]>): VueWrapper {
  const Root = defineComponent({ render: () => children.map(([c, p]) => h(c, p)) });
  const wrapper = mount(Root);
  wrappers.push(wrapper);
  return wrapper;
}
function renderChat(props: Partial<ReplyzeChatProps> & Record<string, unknown>) {
  const wrapper = mount(ReplyzeChat, { props: { token: 'wgt_test', ...props } as ReplyzeChatProps });
  wrappers.push(wrapper);
  return wrapper;
}
function cleanup(): void {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
}

beforeEach(() => {
  newPage();
  idleQueue = [];
  w.requestIdleCallback = vi.fn((cb: () => void) => idleQueue.push(cb));
  w.cancelIdleCallback = vi.fn((id: number) => {
    idleQueue[id - 1] = () => undefined;
  });
  lastState = null;
});

afterEach(() => {
  cleanup();
  setReadyState(null);
  Reflect.deleteProperty(window, 'requestIdleCallback');
  Reflect.deleteProperty(window, 'cancelIdleCallback');
});

describe('<ReplyzeChat> loading', () => {
  it('renders nothing and requests widget.js after the load event, when idle (lazyOnload)', () => {
    setReadyState('interactive');
    const wrapper = renderChat({});
    expect(wrapper.html()).toBe('');
    expect(wrapper.element.nodeType).toBe(Node.COMMENT_NODE);
    expect(widgetScripts()).toHaveLength(0);
    expect(idleQueue).toHaveLength(0);

    setReadyState('complete');
    window.dispatchEvent(new Event('load'));
    expect(idleQueue).toHaveLength(1);
    expect(w.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    expect(widgetScripts()).toHaveLength(0);

    runIdle();
    const [script] = widgetScripts();
    expect(script.src).toBe(DEFAULT_SCRIPT_URL);
    expect(script.async).toBe(true);
    expect(script.hasAttribute('data-replyze-vue')).toBe(true);
    expect(script.parentElement).toBe(document.head);
  });

  it('falls back to a timeout where requestIdleCallback is missing (Safari)', async () => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    renderChat({});
    expect(widgetScripts()).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 5));
    expect(widgetScripts()).toHaveLength(1);
  });

  it('requests it right after mount with strategy="afterInteractive"', () => {
    renderChat({ strategy: 'afterInteractive' });
    expect(widgetScripts()).toHaveLength(1);
  });

  it("sets window.ReplyzeConfig from the props, with the widget's own names", () => {
    renderChat({
      token: ' wgt_test ',
      apiUrl: 'https://api.example.test///',
      language: 'de',
      tracking: false,
      color: '#1eabd2',
      position: 'bottom_left',
      theme: 'dark',
      botName: 'Ava',
      botAvatar: 'https://cdn.example.test/ava.png',
      welcomeMessage: 'Hi!',
      showGreetingTeaser: false,
      autoOpenDelay: 10,
      strategy: 'afterInteractive',
      scriptUrl: 'https://cdn.example.test/widget.js',
      nonce: 'abc123',
    });
    expect(w.ReplyzeConfig).toEqual({
      token: 'wgt_test',
      apiUrl: 'https://api.example.test',
      language: 'de',
      tracking: false,
      overrides: {
        color: '#1eabd2',
        position: 'bottom_left',
        theme: 'dark',
        bot_name: 'Ava',
        bot_avatar: 'https://cdn.example.test/ava.png',
        welcome_message: 'Hi!',
        show_greeting_teaser: false,
        auto_open_delay: 10,
      },
    });
    const [script] = widgetScripts();
    expect(script.src).toBe('https://cdn.example.test/widget.js');
    expect(script.nonce).toBe('abc123');
  });

  it('takes kebab-case attributes, as templates write them', () => {
    render([ReplyzeChat, { token: 'wgt_test', 'bot-name': 'Ava', 'show-greeting-teaser': true, 'auto-open-delay': 5, strategy: 'afterInteractive' }]);
    expect(w.ReplyzeConfig).toEqual({ token: 'wgt_test', overrides: { bot_name: 'Ava', show_greeting_teaser: true, auto_open_delay: 5 } });
  });

  it('leaves tracking and the greeting teaser to the widget when the boolean props are not given', () => {
    renderChat({ strategy: 'afterInteractive' });
    expect(w.ReplyzeConfig).toEqual({ token: 'wgt_test' });
  });

  it('sets only the token when nothing else is given, and keeps other ReplyzeConfig keys', () => {
    w.ReplyzeConfig = { identityToken: 'from-the-page' };
    renderChat({ strategy: 'afterInteractive' });
    expect(w.ReplyzeConfig).toEqual({ identityToken: 'from-the-page', token: 'wgt_test' });
  });

  it('ignores an apiUrl that is not http(s)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderChat({ apiUrl: 'javascript:alert(1)', strategy: 'afterInteractive' });
    expect(w.ReplyzeConfig).toEqual({ token: 'wgt_test' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('apiUrl'));
  });

  it('does not load without a token, or with an API key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const wrapper = renderChat({ token: '', strategy: 'afterInteractive' });
    await wrapper.setProps({ token: 'rpz_live_abc' });
    expect(widgetScripts()).toHaveLength(0);
    expect(w.ReplyzeConfig).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No widget token'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('API key'));
  });
});

describe('once per page', () => {
  it('loads it once for two instances', () => {
    render([ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }], [ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }]);
    expect(widgetScripts()).toHaveLength(1);
  });

  it('loads it once for two instances (lazyOnload)', () => {
    render([ReplyzeChat, { token: 'wgt_test' }], [ReplyzeChat, { token: 'wgt_test' }]);
    runIdle();
    expect(widgetScripts()).toHaveLength(1);
  });

  it('keeps the widget across unmount and remount, without a second script', () => {
    const first = renderChat({ strategy: 'afterInteractive' });
    const widget = deliverScript()!;
    first.unmount();
    render([ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }], [StateProbe]);
    expect(widgetScripts()).toHaveLength(1);
    expect(lastState!.status.value).toBe('ready');
    expect(widget.listenerCount('open')).toBe(1);
  });

  it('does not request the script when unmounted before it was due', () => {
    const wrapper = renderChat({});
    expect(idleQueue).toHaveLength(1);
    wrapper.unmount();
    runIdle();
    expect(widgetScripts()).toHaveLength(0);
  });

  it('uses a widget started by a <script> snippet instead of loading another', () => {
    w.ReplyzeConfig = { token: 'wgt_snippet' };
    const widget = startFakeWidget()!;
    render([ReplyzeChat, { token: 'wgt_snippet', language: 'fr', strategy: 'afterInteractive' }], [StateProbe]);
    expect(widgetScripts()).toHaveLength(0);
    expect(lastState!.status.value).toBe('ready');
    expect(widget.calls).toContainEqual(['setLanguage', ['fr']]);
    widget.open();
    expect(lastState!.isOpen.value).toBe(true);
  });

  it('waits for a widget.js tag that is already on the page', () => {
    const tag = document.createElement('script');
    tag.src = DEFAULT_SCRIPT_URL;
    document.body.appendChild(tag);
    w.ReplyzeConfig = { token: 'wgt_snippet' };
    render([ReplyzeChat, { token: 'wgt_snippet', strategy: 'afterInteractive' }], [StateProbe]);
    expect(widgetScripts()).toHaveLength(1);
    expect(lastState!.status.value).toBe('loading');
    deliverScript(tag);
    expect(lastState!.status.value).toBe('ready');
  });
});

describe('status', () => {
  it('goes idle → loading → ready', () => {
    render([StateProbe]);
    expect(lastState!.status.value).toBe('idle');
    renderChat({});
    expect(lastState!.status.value).toBe('loading');
    runIdle();
    deliverScript();
    expect(lastState!.status.value).toBe('ready');
  });

  it('is error when the script fails to load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render([ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }], [StateProbe]);
    failScript();
    expect(lastState!.status.value).toBe('error');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not load https://cdn.replyze.chat/widget.js'));
  });

  it('is error when the script loads but the widget does not start', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render([ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }], [StateProbe]);
    widgetScripts()[0].dispatchEvent(new Event('load'));
    expect(lastState!.status.value).toBe('error');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not start'));
  });

  it('waits for DOMContentLoaded when the widget starts then (script ran while the page was loading)', () => {
    setReadyState('loading');
    render([ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }], [StateProbe]);
    widgetScripts()[0].dispatchEvent(new Event('load'));
    expect(lastState!.status.value).toBe('loading');
    startFakeWidget();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(lastState!.status.value).toBe('ready');
  });
});

describe('props after load', () => {
  function loaded(props: Partial<ReplyzeChatProps> = {}) {
    const wrapper = renderChat({ strategy: 'afterInteractive', ...props });
    const widget = deliverScript()!;
    return { widget, setProps: (p: Partial<ReplyzeChatProps>) => wrapper.setProps(p) };
  }

  it('applies language and tracking changes through setLanguage / setTracking', async () => {
    const { widget, setProps } = loaded({ language: 'en' });
    await setProps({ language: 'de' });
    await setProps({ tracking: false });
    await setProps({ tracking: true });
    expect(widget.calls).toEqual([
      ['setLanguage', ['de']],
      ['setTracking', [false]],
      ['setTracking', [true]],
    ]);
  });

  it('warns once that load-time props change on the next page load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { setProps } = loaded({ color: '#111111' });
    await setProps({ color: '#222222' });
    await setProps({ color: '#333333' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('next page load');
    expect(widgetScripts()).toHaveLength(1);
  });
});

describe('events as Vue events', () => {
  it('re-emits the widget events, ready included', async () => {
    const wrapper = renderChat({ strategy: 'afterInteractive' });
    const widget = deliverScript()!;
    widget.receive('Hi');
    widget.open();
    widget.close();
    widget.emit('message:sent', { text: 'Hello' });
    widget.emit('identified', { verified: true });
    widget.reset();
    await nextTick();
    const emitted = wrapper.emitted();
    expect(emitted.ready).toEqual([[]]);
    expect(emitted.unread).toEqual([[1], [0]]);
    expect((emitted['message:received'] as unknown[][])[0][0]).toMatchObject({ content: 'Hi' });
    expect(emitted['message:sent']).toEqual([[{ text: 'Hello' }]]);
    expect(emitted.open).toHaveLength(1);
    expect(emitted.close).toHaveLength(2);
    expect(emitted.identified).toEqual([[{ verified: true }]]);
    expect(emitted.reset).toEqual([[]]);
  });

  it('emits ready for a widget that was already running', async () => {
    renderChat({ strategy: 'afterInteractive' });
    deliverScript();
    const late = renderChat({ strategy: 'afterInteractive' });
    await Promise.resolve();
    expect(late.emitted().ready).toEqual([[]]);
  });

  it('calls @open listeners while mounted and stops after unmount', () => {
    const onOpen = vi.fn();
    const wrapper = renderChat({ strategy: 'afterInteractive', onOpen });
    const widget = deliverScript()!;
    widget.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    widget.close();
    widget.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    // The package's own listener on the widget stays: the widget keeps running.
    expect(widget.listenerCount('open')).toBe(1);
  });
});

describe('the user prop', () => {
  const ana = { user_id: 42, email: 'ana@shop.example', name: 'Ana', user_hash: 'abc' };

  function identifies(widget: FakeWidget) {
    return widget.calls.filter(([m]) => m === 'identify' || m === 'reset');
  }

  it('does nothing while undefined', () => {
    renderChat({ strategy: 'afterInteractive' });
    const widget = deliverScript()!;
    expect(identifies(widget)).toEqual([]);
  });

  it('identifies once, and the call waits for the widget', () => {
    renderChat({ strategy: 'afterInteractive', user: ana });
    const widget = deliverScript()!;
    expect(identifies(widget)).toEqual([['identify', [ana]]]);
  });

  it('does not identify again with an equal user object', async () => {
    const wrapper = renderChat({ strategy: 'afterInteractive', user: ana });
    const widget = deliverScript()!;
    await wrapper.setProps({ user: { ...ana } });
    expect(identifies(widget)).toHaveLength(1);
  });

  it('identifies again without a reset when only the name changes', async () => {
    const wrapper = renderChat({ strategy: 'afterInteractive', user: ana });
    const widget = deliverScript()!;
    await wrapper.setProps({ user: { ...ana, name: 'Ana B.' } });
    expect(identifies(widget).map(([m]) => m)).toEqual(['identify', 'identify']);
  });

  it('resets on sign-out (null) and before another user', async () => {
    const wrapper = renderChat({ strategy: 'afterInteractive', user: ana });
    const widget = deliverScript()!;
    await wrapper.setProps({ user: null });
    await wrapper.setProps({ user: ana });
    await wrapper.setProps({ user: { user_id: 7, email: 'bo@shop.example' } });
    expect(identifies(widget).map(([m]) => m)).toEqual(['identify', 'reset', 'identify', 'reset', 'identify']);
  });

  it('remembers across a page load: null resets, the same user does not, another user resets first', () => {
    renderChat({ strategy: 'afterInteractive', user: ana });
    deliverScript();
    cleanup();

    // Reload, same user: identify only.
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: ana });
    let widget = deliverScript()!;
    expect(identifies(widget).map(([m]) => m)).toEqual(['identify']);
    cleanup();

    // Reload after sign-out: reset.
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: null });
    widget = deliverScript()!;
    expect(identifies(widget).map(([m]) => m)).toEqual(['reset']);
    cleanup();

    // Reload, still signed out: nothing more.
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: null });
    widget = deliverScript()!;
    expect(identifies(widget)).toEqual([]);
    cleanup();

    // Sign in as Ana, then reload as someone else: reset, then identify.
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: ana });
    deliverScript();
    cleanup();
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: { email: 'Bo@Shop.example' } });
    widget = deliverScript()!;
    expect(identifies(widget).map(([m]) => m)).toEqual(['reset', 'identify']);
  });

  it('resets before a user with neither id nor email: a name alone is not the same user', async () => {
    const wrapper = renderChat({ strategy: 'afterInteractive', user: ana });
    const widget = deliverScript()!;
    await wrapper.setProps({ user: { name: 'Bo' } });
    expect(identifies(widget).map(([m]) => m)).toEqual(['identify', 'reset', 'identify']);
    cleanup();

    // And across a page load.
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: ana });
    deliverScript();
    cleanup();
    newPage({ keepStorage: true });
    renderChat({ strategy: 'afterInteractive', user: { name: 'Bo' } });
    expect(identifies(deliverScript()!).map(([m]) => m)).toEqual(['reset', 'identify']);
  });

  it('does not keep the email or the id in localStorage', () => {
    renderChat({ strategy: 'afterInteractive', user: ana });
    const stored = Object.keys(window.localStorage).map((k) => `${k}=${window.localStorage.getItem(k)}`).join(';');
    expect(stored).toMatch(/^replyze-vue:user=[0-9a-z]+$/);
    expect(stored).not.toContain('ana');
    expect(stored).not.toContain('42');
  });

  it('Replyze.reset() also forgets the user for the next page load', () => {
    renderChat({ strategy: 'afterInteractive', user: ana });
    deliverScript();
    Replyze.reset();
    expect(window.localStorage.getItem('replyze-vue:user')).toBeNull();
  });
});

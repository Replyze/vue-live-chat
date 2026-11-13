import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Replyze, ReplyzeChat, useReplyze } from '../src';
import { deliverScript, newPage, widgetScripts } from './support/fakeWidget';

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  ReplyzeConfig?: Record<string, unknown>;
};
const w = window as IdleWindow;
let idleQueue: Array<() => void> = [];
const apps: App[] = [];

function app(root = defineComponent({ render: () => null })): App {
  const a = createApp(root);
  apps.push(a);
  return a;
}

beforeEach(() => {
  newPage();
  idleQueue = [];
  w.requestIdleCallback = vi.fn((cb: () => void) => idleQueue.push(cb));
  w.cancelIdleCallback = vi.fn((id: number) => {
    idleQueue[id - 1] = () => undefined;
  });
});

afterEach(() => {
  for (const a of apps.splice(0)) {
    if ((a as { _container?: unknown })._container) a.unmount();
  }
  Reflect.deleteProperty(window, 'requestIdleCallback');
  Reflect.deleteProperty(window, 'cancelIdleCallback');
});

describe('app.use(Replyze, options)', () => {
  it('is the widget API with a non-enumerable install()', () => {
    expect(typeof Replyze.install).toBe('function');
    expect(Object.keys(Replyze).sort()).toEqual([
      'close', 'hide', 'identify', 'off', 'on', 'open', 'openArticle', 'pushEvent',
      'reset', 'sendMessage', 'setData', 'setLanguage', 'setTracking', 'setUser', 'show', 'toggle',
    ]);
  });

  it('loads the widget with the options, under the widget\'s own names', () => {
    app().use(Replyze, {
      token: 'wgt_plugin',
      language: 'de',
      tracking: false,
      color: '#0e7490',
      position: 'bottom_left',
      botName: 'Ava',
      showGreetingTeaser: true,
      strategy: 'afterInteractive',
    });
    expect(w.ReplyzeConfig).toEqual({
      token: 'wgt_plugin',
      language: 'de',
      tracking: false,
      overrides: { color: '#0e7490', position: 'bottom_left', bot_name: 'Ava', show_greeting_teaser: true },
    });
    expect(widgetScripts()).toHaveLength(1);
    expect(widgetScripts()[0].hasAttribute('data-replyze-vue')).toBe(true);
  });

  it('waits for the load event and idle time by default', () => {
    app().use(Replyze, { token: 'wgt_plugin' });
    expect(widgetScripts()).toHaveLength(0);
    expect(idleQueue).toHaveLength(1);
    idleQueue.splice(0).forEach((cb) => cb());
    expect(widgetScripts()).toHaveLength(1);
  });

  it('feeds useReplyze() in the app, and calls made early wait for the widget', async () => {
    const Root = defineComponent({
      setup() {
        const { status, isOpen } = useReplyze();
        return () => h('p', `${status.value} ${isOpen.value}`);
      },
    });
    const a = app(Root).use(Replyze, { token: 'wgt_plugin', strategy: 'afterInteractive' });
    const el = document.createElement('div');
    document.body.appendChild(el);
    a.mount(el);
    Replyze.open();
    await nextTick();
    expect(el.textContent).toBe('loading false');
    const widget = deliverScript()!;
    await nextTick();
    expect(el.textContent).toBe('ready true');
    expect(widget.calls).toEqual([['open', []]]);
  });

  it('does not request the script when the app unmounts before it was due (Vue 3.5+)', () => {
    const a = app();
    if (typeof (a as { onUnmount?: unknown }).onUnmount !== 'function') return;
    a.use(Replyze, { token: 'wgt_plugin' });
    a.mount(document.createElement('div'));
    expect(idleQueue).toHaveLength(1);
    a.unmount();
    idleQueue.splice(0).forEach((cb) => cb());
    expect(widgetScripts()).toHaveLength(0);
  });

  it('does nothing without options', () => {
    expect(() => app().use(Replyze)).not.toThrow();
    expect(widgetScripts()).toHaveLength(0);
    expect(idleQueue).toHaveLength(0);
  });

  it('warns and does not load with an API key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    app().use(Replyze, { token: 'rpz_live_secret', strategy: 'afterInteractive' });
    expect(widgetScripts()).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('API key'));
  });

  it('shares the one widget with a <ReplyzeChat> in the same page', () => {
    const Root = defineComponent({ render: () => h(ReplyzeChat, { token: 'wgt_plugin', strategy: 'afterInteractive' }) });
    app(Root).use(Replyze, { token: 'wgt_plugin', strategy: 'afterInteractive' }).mount(document.createElement('div'));
    expect(widgetScripts()).toHaveLength(1);
  });
});

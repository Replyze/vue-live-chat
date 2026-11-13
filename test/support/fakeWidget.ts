/**
 * A stand-in for widget.js that behaves like widget/src/index.ts in the
 * Replyze widget: it reads window.ReplyzeConfig, runs window.Replyze._queue,
 * replaces window.Replyze with its API and then emits `ready` once, as
 * widget.js does since 2026-11-13 (older builds emitted it in the constructor,
 * before anyone could listen). The real bundle is tested in
 * test/widget.widget.test.ts.
 */
import { resetForTests } from '../../src/core';
import { resetComposablesForTests } from '../../src/composables';

type Callback = (...args: unknown[]) => void;

export class FakeWidget {
  readonly calls: Array<[string, unknown[]]> = [];
  private listeners = new Map<string, Set<Callback>>();
  isOpen = false;
  visible = true;
  unread = 0;

  constructor(readonly config: Record<string, unknown>) {}

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  on(event: string, cb: Callback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: Callback): void {
    this.listeners.get(event)?.delete(cb);
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  record(method: string, args: unknown[]): void {
    this.calls.push([method, args]);
  }

  setUnread(count: number): void {
    if (count === this.unread) return;
    this.unread = count;
    this.emit('unread', count);
  }

  open(): void {
    this.record('open', []);
    this.isOpen = true;
    this.setUnread(0);
    this.emit('open');
  }

  close(): void {
    this.record('close', []);
    this.isOpen = false;
    this.emit('close');
  }

  toggle(): void {
    this.record('toggle', []);
    if (this.isOpen) this.close();
    else this.open();
  }

  reset(): void {
    this.close();
    this.record('reset', []);
    this.emit('reset');
  }

  /** A reply from the team arrives. */
  receive(content: string): void {
    const message = { id: String(Date.now()), content, sender: 'agent', created_at: new Date().toISOString() };
    this.emit('message:received', message);
    if (!this.isOpen) this.setUnread(this.unread + 1);
  }
}

type FakeWindow = Window & { Replyze?: any; ReplyzeConfig?: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** widget/src/index.ts init(), with FakeWidget. Returns null when it doesn't start. */
export function startFakeWidget(): FakeWidget | null {
  const w = window as FakeWindow;
  if (w.Replyze?._initialized) return null;
  const cfg = w.ReplyzeConfig;
  if (!cfg || !cfg.token) {
    console.warn('[Replyze] No config found. Set window.ReplyzeConfig = { token: "..." } or use data-token attribute.');
    return null;
  }
  const widget = new FakeWidget(cfg);
  const recorded = (method: string) => (...args: unknown[]) => widget.record(method, args);
  const api: Record<string, unknown> = {
    open: () => widget.open(),
    close: () => widget.close(),
    toggle: () => widget.toggle(),
    identify: (emailOrUser: unknown, name?: string) => {
      widget.record('identify', name === undefined ? [emailOrUser] : [emailOrUser, name]);
      const verified = typeof emailOrUser === 'object' && !!(emailOrUser as { user_hash?: string }).user_hash;
      queueMicrotask(() => widget.emit('identified', { verified }));
    },
    show: () => { widget.record('show', []); widget.visible = true; },
    hide: () => { widget.record('hide', []); widget.visible = false; },
    reset: () => widget.reset(),
    setLanguage: recorded('setLanguage'),
    sendMessage: recorded('sendMessage'),
    on: (event: string, cb: Callback) => widget.on(event, cb),
    off: (event: string, cb: Callback) => widget.off(event, cb),
    setUser: recorded('setUser'),
    setData: recorded('setData'),
    pushEvent: recorded('pushEvent'),
    setTracking: recorded('setTracking'),
    openArticle: (id: unknown) => widget.record('openArticle', [Number(id)]),
    _widget: widget,
    _initialized: true,
  };
  const existing = w.Replyze;
  if (existing && typeof existing === 'object' && '_queue' in existing && Array.isArray(existing._queue)) {
    for (const [method, ...args] of existing._queue as Array<[string, ...unknown[]]>) {
      if (method in api && typeof api[method] === 'function') (api[method] as Callback)(...args);
    }
  }
  w.Replyze = api;
  widget.emit('ready');
  return widget;
}

/** widget.js script tags on the page. */
export function widgetScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="widget.js"]'));
}

/** What the browser does when widget.js arrives: run it, then fire `load`. */
export function deliverScript(script: HTMLScriptElement = widgetScripts()[0]): FakeWidget | null {
  if (!script) throw new Error('No widget.js script on the page');
  const widget = startFakeWidget();
  script.dispatchEvent(new Event('load'));
  return widget;
}

export function failScript(script: HTMLScriptElement = widgetScripts()[0]): void {
  script.dispatchEvent(new Event('error'));
}

/** A fresh page: no widget, no scripts, no config. localStorage survives unless asked (a reload keeps it). */
export function newPage({ keepStorage = false } = {}): void {
  const w = window as FakeWindow;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete w.Replyze;
  delete w.ReplyzeConfig;
  if (!keepStorage) window.localStorage.clear();
  resetForTests();
  resetComposablesForTests();
}

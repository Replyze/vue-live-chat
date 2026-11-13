/**
 * The Vue-free part: loads widget.js once per page, keeps the state that
 * useReplyze() exposes, passes the widget's events on, and holds calls made
 * before the widget runs.
 *
 * The widget is a page-wide singleton (window.Replyze), so this module is one
 * too. Nothing here touches `window` until a function is called in the
 * browser, and nothing is kept on the server, so one Node process can render
 * many requests.
 */
import type {
  ReplyzeEventHandler,
  ReplyzeEventName,
  ReplyzeIdentity,
  ReplyzeLoadStrategy,
  ReplyzeMethods,
  ReplyzeOptions,
  ReplyzePosition,
  ReplyzeState,
  ReplyzeTheme,
} from './types';
import { identitySubject } from './subject';

export const DEFAULT_SCRIPT_URL = 'https://cdn.replyze.chat/widget.js';

/** window.ReplyzeConfig.overrides: the widget's own names. */
export interface WidgetOverrides {
  color?: string;
  position?: ReplyzePosition;
  theme?: ReplyzeTheme;
  bot_name?: string;
  bot_avatar?: string;
  welcome_message?: string;
  show_greeting_teaser?: boolean;
  auto_open_delay?: number;
}

/** What <ReplyzeChat> and the plugin hand the loader. */
export interface LoaderConfig {
  token: string;
  apiUrl?: string;
  language?: string;
  tracking?: boolean;
  overrides?: WidgetOverrides;
  strategy?: ReplyzeLoadStrategy;
  scriptUrl?: string;
  nonce?: string;
}

/** The options in camelCase to the loader's config, with the look options under the widget's names. */
export function loaderConfig(options: ReplyzeOptions): LoaderConfig {
  const o: WidgetOverrides = {};
  if (options.color != null) o.color = options.color;
  if (options.position != null) o.position = options.position;
  if (options.theme != null) o.theme = options.theme;
  if (options.botName != null) o.bot_name = options.botName;
  if (options.botAvatar != null) o.bot_avatar = options.botAvatar;
  if (options.welcomeMessage != null) o.welcome_message = options.welcomeMessage;
  if (options.showGreetingTeaser != null) o.show_greeting_teaser = options.showGreetingTeaser;
  if (options.autoOpenDelay != null) o.auto_open_delay = options.autoOpenDelay;
  return {
    token: options.token,
    apiUrl: options.apiUrl,
    language: options.language,
    tracking: options.tracking,
    overrides: Object.keys(o).length > 0 ? o : undefined,
    strategy: options.strategy,
    scriptUrl: options.scriptUrl,
    nonce: options.nonce,
  };
}

type AnyHandler = (...args: unknown[]) => void;

/** window.Replyze once the widget runs (widget/src/index.ts). */
interface WidgetApi {
  _initialized?: boolean;
  on(event: string, callback: AnyHandler): void;
  off(event: string, callback: AnyHandler): void;
  [method: string]: unknown;
}

type ReplyzeWindow = Window & {
  Replyze?: unknown;
  ReplyzeConfig?: unknown;
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * The events window.Replyze.on() emits, without `ready`: this module emits its
 * own when it finds the widget running. widget.js from 2026-11-13 on fires
 * `ready` once, after its queued commands ran and window.Replyze is set;
 * older builds fired it before anyone could listen. Either way it is not
 * passed on, so `ready` reaches a handler once.
 */
const WIDGET_EVENTS = ['open', 'close', 'unread', 'message:sent', 'message:received', 'identified', 'reset'] as const;
/** Every event, `ready` included: what <ReplyzeChat> re-emits. */
export const EVENTS: readonly ReplyzeEventName[] = ['ready', ...WIDGET_EVENTS];
const MAX_PENDING = 100;
/** Calls about who the user is: never the ones dropped when too many wait. */
const IDENTITY_CALLS = new Set(['reset', 'identify', 'setUser']);
const IDLE_TIMEOUT_MS = 3000;
const USER_MARK_KEY = 'replyze-vue:user';
const TAG = '[Replyze]';
const NOOP = (): void => undefined;

// ---------------------------------------------------------------------------
// State for useReplyze()

export const INITIAL_STATE: ReplyzeState = Object.freeze({ status: 'idle', isOpen: false, unreadCount: 0 });

let state: ReplyzeState = INITIAL_STATE;
const stateListeners = new Set<() => void>();

function setState(patch: Partial<ReplyzeState>): void {
  const next: ReplyzeState = { ...state, ...patch };
  if (next.status === state.status && next.isOpen === state.isOpen && next.unreadCount === state.unreadCount) return;
  state = next;
  for (const listener of Array.from(stateListeners)) listener();
}

export function getState(): ReplyzeState {
  return state;
}

/** Called on every state change. In the browser only (on the server nothing changes). */
export function subscribe(listener: () => void): () => void {
  if (!getWindow()) return NOOP;
  stateListeners.add(listener);
  // A widget from a plain <script> snippet (no <ReplyzeChat>, no plugin) still gets listened to.
  adoptRunningWidget();
  if (!started) {
    const existing = findScript(DEFAULT_SCRIPT_URL);
    if (existing) {
      started = true;
      setState({ status: 'loading' });
      watch(existing);
    }
  }
  return () => {
    stateListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Events

const handlers = new Map<ReplyzeEventName, Set<AnyHandler>>();

function dispatch(event: ReplyzeEventName, args: unknown[]): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(...args);
    } catch (error) {
      console.error(`${TAG} A "${event}" listener threw:`, error);
    }
  }
}

function on<E extends ReplyzeEventName>(event: E, handler: ReplyzeEventHandler<E>): () => void {
  // On the server there are no events, and a listener kept here would outlive the request.
  if (!getWindow()) return NOOP;
  const fn = handler as AnyHandler;
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(fn);
  const wasReady = state.status === 'ready';
  adoptRunningWidget();
  // `ready` has already happened: tell this listener too, once.
  if (event === 'ready' && wasReady) {
    Promise.resolve().then(() => {
      if (handlers.get('ready')?.has(fn)) fn();
    });
  }
  return () => off(event, handler);
}

function off<E extends ReplyzeEventName>(event: E, handler: ReplyzeEventHandler<E>): void {
  handlers.get(event)?.delete(handler as AnyHandler);
}

// ---------------------------------------------------------------------------
// The running widget

function getWindow(): ReplyzeWindow | null {
  return typeof window === 'undefined' ? null : (window as ReplyzeWindow);
}

function runningWidget(): WidgetApi | null {
  const api = getWindow()?.Replyze as WidgetApi | undefined;
  return api && typeof api === 'object' && api._initialized === true && typeof api.on === 'function' ? api : null;
}

/** The window.Replyze we listen to. */
let attached: WidgetApi | null = null;
/** Calls made before the widget ran, replayed in order once it does. */
const pending: Array<[string, unknown[]]> = [];

function onWidgetEvent(event: (typeof WIDGET_EVENTS)[number], args: unknown[]): void {
  if (event === 'open') setState({ isOpen: true });
  else if (event === 'close') setState({ isOpen: false });
  else if (event === 'unread') setState({ unreadCount: typeof args[0] === 'number' ? args[0] : 0 });
  dispatch(event, args);
}

function attach(api: WidgetApi): void {
  if (attached === api) return;
  attached = api;
  for (const event of WIDGET_EVENTS) {
    api.on(event, (...args: unknown[]) => onWidgetEvent(event, args));
  }
  setState({ status: 'ready' });
  // After the listeners, so an early open() still updates isOpen.
  for (const [method, args] of pending.splice(0)) invoke(api, method, args);
  dispatch('ready', []);
}

function adoptRunningWidget(): void {
  const api = runningWidget();
  if (api && api !== attached) {
    started = true;
    attach(api);
  }
}

function invoke(api: WidgetApi, method: string, args: unknown[]): void {
  const fn = api[method];
  if (typeof fn !== 'function') {
    console.warn(`${TAG} This version of the widget has no ${method}().`);
    return;
  }
  try {
    (fn as AnyHandler).apply(api, args);
  } catch (error) {
    console.error(`${TAG} ${method}() failed:`, error);
  }
}

/**
 * A call that waits for the widget. When MAX_PENDING wait, the oldest call
 * that isn't a sign-in or sign-out makes room: a lost reset() or identify()
 * could leave the previous user's chat on screen. With only those waiting,
 * the oldest identify goes (a later one says who it is now), else a reset
 * (another one is still waiting).
 */
function enqueue(method: string, args: unknown[]): void {
  if (pending.length >= MAX_PENDING) {
    let drop = pending.findIndex(([m]) => !IDENTITY_CALLS.has(m));
    if (drop === -1) drop = pending.findIndex(([m]) => m !== 'reset');
    pending.splice(drop === -1 ? 0 : drop, 1);
  }
  pending.push([method, args]);
}

function call(method: string, args: unknown[]): void {
  if (!getWindow()) return;
  const api = runningWidget();
  if (!api) {
    enqueue(method, args);
    return;
  }
  if (api !== attached) {
    started = true;
    attach(api);
  }
  invoke(api, method, args);
}

// ---------------------------------------------------------------------------
// The methods (the `Replyze` object, and what useReplyze() returns with the state)

export const methods: ReplyzeMethods = {
  open: () => call('open', []),
  close: () => call('close', []),
  toggle: () => call('toggle', []),
  show: () => call('show', []),
  hide: () => call('hide', []),
  identify: (emailOrUser: string | ReplyzeIdentity, name?: string) =>
    call('identify', typeof emailOrUser === 'string' && name !== undefined ? [emailOrUser, name] : [plain(emailOrUser)]),
  reset: () => {
    forgetUserMark();
    call('reset', []);
  },
  setLanguage: (language) => call('setLanguage', [language]),
  sendMessage: (text) => call('sendMessage', [text]),
  setUser: (user) => call('setUser', [plain(user)]),
  setData: (data) => call('setData', [plain(data)]),
  pushEvent: (name, data) => call('pushEvent', data === undefined ? [name] : [name, plain(data)]),
  setTracking: (allowed) => call('setTracking', [allowed]),
  openArticle: (articleId) => call('openArticle', [articleId]),
  on,
  off,
};

/**
 * A plain copy of an object the caller may have made reactive (a Vue
 * `reactive()` or a ref's value): the widget keeps what it is given, and a
 * proxy would let later changes leak in.
 */
function plain<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Loading widget.js

/** The latest config from <ReplyzeChat> or the plugin. */
let config: LoaderConfig | null = null;
/** What the running widget was started with (language and tracking follow the config after that). */
let loaded: LoaderConfig | null = null;
/** A widget script is on the page or on its way (ours or someone else's). */
let started = false;
let cancelScheduled: (() => void) | null = null;
let mounted = 0;
let warnedLoadTime = false;
let lastTokenProblem: string | null = null;

function tokenProblem(token: unknown): string | null {
  if (typeof token !== 'string' || token.trim() === '') {
    return 'No widget token: pass token="wgt_..." to <ReplyzeChat> or app.use(Replyze, { token }) (Settings → Integrations → Install widget).';
  }
  if (token.trim().startsWith('rpz_')) {
    return 'That token is an API key (rpz_...), a secret that must never be in a web page; the widget was not loaded. The chat takes the widget token (wgt_...) from Settings → Integrations → Install widget. Revoke the key if it was published.';
  }
  return null;
}

function normalizeApiUrl(apiUrl: string | undefined): string | undefined {
  if (!apiUrl) return undefined;
  const url = apiUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s"'<>]+$/.test(url)) {
    console.warn(`${TAG} apiUrl "${apiUrl}" is not an http(s) URL; using the default.`);
    return undefined;
  }
  return url;
}

/** window.ReplyzeConfig for this config: only what was set. */
function widgetConfig(cfg: LoaderConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { token: cfg.token.trim() };
  const apiUrl = normalizeApiUrl(cfg.apiUrl);
  if (apiUrl) out.apiUrl = apiUrl;
  if (cfg.language) out.language = cfg.language;
  if (cfg.tracking === false) out.tracking = false;
  if (cfg.overrides && Object.keys(cfg.overrides).length > 0) out.overrides = { ...cfg.overrides };
  return out;
}

function loadTimeKey(cfg: LoaderConfig): string {
  return JSON.stringify([cfg.token.trim(), normalizeApiUrl(cfg.apiUrl) ?? null, cfg.scriptUrl || DEFAULT_SCRIPT_URL, cfg.overrides ?? {}]);
}

function findScript(src: string): HTMLScriptElement | null {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    const own = s.getAttribute('src');
    if (own && (s.src === src || own === src || s.src.split(/[?#]/)[0] === src)) return s;
  }
  return null;
}

/** After the page's load event, when the browser is idle (or after IDLE_TIMEOUT_MS at the latest). */
function whenIdleAfterLoad(run: () => void): () => void {
  const w = window as ReplyzeWindow;
  let idleId: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = () => {
    if (typeof w.requestIdleCallback === 'function') idleId = w.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    else timer = setTimeout(run, 1);
  };
  if (document.readyState === 'complete') idle();
  else w.addEventListener('load', idle, { once: true });
  return () => {
    w.removeEventListener('load', idle);
    if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId);
    if (timer !== undefined) clearTimeout(timer);
  };
}

/** Wait for a widget script (ours or one already on the page) to start the widget. */
function watch(script: HTMLScriptElement): void {
  const check = (): boolean => {
    const api = runningWidget();
    if (api) attach(api);
    return !!api;
  };
  if (check()) return;
  const fail = (why: string) => {
    if (state.status === 'ready') return;
    setState({ status: 'error' });
    console.warn(`${TAG} ${why}`);
  };
  const notStarted = 'widget.js loaded but the widget did not start; see the [Replyze] message before this one.';
  // A script that already ran, waiting for DOMContentLoaded to start.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void check(), { once: true });
  script.addEventListener(
    'load',
    () => {
      if (check()) return;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => check() || fail(notStarted), { once: true });
      } else {
        fail(notStarted);
      }
    },
    { once: true },
  );
  script.addEventListener(
    'error',
    () => fail(`Could not load ${script.src}. A network error, an ad blocker or the page's Content-Security-Policy (script-src https://cdn.replyze.chat) can block it.`),
    { once: true },
  );
}

function inject(): void {
  const w = getWindow();
  const cfg = config;
  if (!w || !cfg || started) return;
  if (runningWidget()) {
    adoptRunningWidget();
    return;
  }
  started = true;
  loaded = { ...cfg };
  const current = w.ReplyzeConfig && typeof w.ReplyzeConfig === 'object' ? (w.ReplyzeConfig as Record<string, unknown>) : {};
  w.ReplyzeConfig = { ...current, ...widgetConfig(cfg) };

  const script = document.createElement('script');
  script.src = cfg.scriptUrl || DEFAULT_SCRIPT_URL;
  script.async = true;
  if (cfg.nonce) script.nonce = cfg.nonce;
  script.setAttribute('data-replyze-vue', '');
  setState({ status: 'loading' });
  watch(script);
  (document.head || document.body).appendChild(script);
}

/** Language and tracking follow the config after load; the rest is read once by the widget. */
function applyLiveChanges(next: LoaderConfig): void {
  if (!loaded) return;
  if (next.language && next.language !== loaded.language) {
    loaded.language = next.language;
    call('setLanguage', [next.language]);
  }
  const tracking = next.tracking !== false;
  if (tracking !== (loaded.tracking !== false)) {
    loaded.tracking = tracking;
    call('setTracking', [tracking]);
  }
  if (!warnedLoadTime && loadTimeKey(next) !== loadTimeKey(loaded)) {
    warnedLoadTime = true;
    console.warn(
      `${TAG} token, apiUrl, scriptUrl and the look options (color, position, theme, botName, botAvatar, welcomeMessage, showGreetingTeaser, autoOpenDelay) are read once, when the widget loads. The change applies on the next page load.`,
    );
  }
}

/** A <ReplyzeChat> mounted (or the plugin was installed); the returned function is its unmount. */
export function mountChat(): () => void {
  mounted++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    mounted--;
    // Unmounted before the script was requested: don't request it.
    if (mounted === 0 && cancelScheduled) {
      cancelScheduled();
      cancelScheduled = null;
      if (state.status === 'loading') setState({ status: 'idle' });
    }
  };
}

/** <ReplyzeChat> or the plugin has this config: load the widget, or apply what can change live. */
export function configure(next: LoaderConfig): void {
  if (!getWindow()) return;
  const problem = tokenProblem(next.token);
  if (problem) {
    if (problem !== lastTokenProblem) console.warn(`${TAG} ${problem}`);
    lastTokenProblem = problem;
    return;
  }
  lastTokenProblem = null;
  config = next;

  if (started) {
    // Adopted from a <script> snippet before this config came: its language and tracking are unknown.
    if (!loaded) loaded = { ...next, language: undefined, tracking: undefined };
    applyLiveChanges(next);
    return;
  }

  // Started by a <script> snippet on the page: listen to it, and apply language and tracking.
  const scriptUrl = next.scriptUrl || DEFAULT_SCRIPT_URL;
  const running = runningWidget();
  const existing = running ? null : findScript(scriptUrl);
  if (running || existing) {
    started = true;
    loaded = { ...next, language: undefined, tracking: undefined };
    if (running) attach(running);
    else {
      setState({ status: 'loading' });
      watch(existing!);
    }
    applyLiveChanges(next);
    return;
  }

  if (next.strategy === 'afterInteractive') {
    if (cancelScheduled) {
      cancelScheduled();
      cancelScheduled = null;
    }
    inject();
    return;
  }
  if (!cancelScheduled) {
    setState({ status: 'loading' });
    cancelScheduled = whenIdleAfterLoad(() => {
      cancelScheduled = null;
      inject();
    });
  }
}

// ---------------------------------------------------------------------------
// The `user` prop: identify a signed-in user, reset when they sign out

/** The user identified through the prop on this page. */
let lastUserKey: string | null = null;
/** Without localStorage: the mark for this page only. */
let memoryMark: string | null = null;

/** A short fingerprint of who was identified, so a reload can tell a sign-out or another user (no email or id stored). */
function fingerprint(subject: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < subject.length; i++) {
    h ^= subject.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function readUserMark(): string | null {
  try {
    return window.localStorage.getItem(USER_MARK_KEY);
  } catch {
    return memoryMark;
  }
}

function writeUserMark(mark: string | null): void {
  memoryMark = mark;
  try {
    if (mark === null) window.localStorage.removeItem(USER_MARK_KEY);
    else window.localStorage.setItem(USER_MARK_KEY, mark);
  } catch {
    /* storage blocked: memoryMark only */
  }
}

function forgetUserMark(): void {
  lastUserKey = null;
  if (getWindow()) writeUserMark(null);
}

/**
 * undefined: not known yet (auth still loading), do nothing.
 * null: nobody is signed in; forget a user this browser identified before.
 * a user: identify them, after a reset when someone else was identified here.
 */
export function syncUser(user: ReplyzeIdentity | null | undefined): void {
  if (user === undefined || !getWindow()) return;
  const previous = readUserMark();
  if (user === null) {
    if (previous !== null || lastUserKey !== null) methods.reset();
    return;
  }
  const key = JSON.stringify([user.user_id ?? null, user.email ?? null, user.name ?? null, user.user_hash ?? null]);
  if (key === lastUserKey) return;
  const subject = identitySubject(user);
  const mark = subject === null ? null : fingerprint(subject);
  // Another user, or one with neither id nor email (a name alone can't be
  // told apart from the previous user, so it starts fresh too).
  if (previous !== null && previous !== mark) methods.reset();
  methods.identify(user);
  lastUserKey = key;
  if (mark !== null) writeUserMark(mark);
}

// ---------------------------------------------------------------------------

/** Tests only: how many event listeners this module holds. Not exported from the package. */
export function listenerCountForTests(): number {
  let count = stateListeners.size;
  for (const set of handlers.values()) count += set.size;
  return count;
}

/** Tests only: back to a fresh page. Not exported from the package. */
export function resetForTests(): void {
  cancelScheduled?.();
  state = INITIAL_STATE;
  stateListeners.clear();
  handlers.clear();
  attached = null;
  pending.length = 0;
  config = null;
  loaded = null;
  started = false;
  cancelScheduled = null;
  mounted = 0;
  warnedLoadTime = false;
  lastTokenProblem = null;
  lastUserKey = null;
  memoryMark = null;
}

import type { App } from 'vue';
import { configure, loaderConfig, methods, mountChat } from './core';
import type { ReplyzeMethods, ReplyzeOptions } from './types';

/** `Replyze` is both the widget's API and a Vue plugin. */
export interface ReplyzePlugin extends ReplyzeMethods {
  /**
   * `app.use(Replyze, { token: 'wgt_...' })`: load the widget for this app,
   * without a `<ReplyzeChat>` in a template. The options are read once.
   * Does nothing on the server, and nothing without options.
   */
  install(app: App, options?: ReplyzeOptions): void;
}

function install(app: App, options?: ReplyzeOptions): void {
  if (!options || typeof window === 'undefined') return;
  const release = mountChat();
  configure(loaderConfig(options));
  // Vue 3.5+: an app unmounted before widget.js was due doesn't request it.
  const onUnmount = (app as { onUnmount?: (cleanup: () => void) => void }).onUnmount;
  if (typeof onUnmount === 'function') onUnmount.call(app, release);
}

/**
 * The widget's JavaScript API, usable anywhere (stores, router guards, auth
 * callbacks), and the Vue plugin:
 *
 * ```ts
 * app.use(Replyze, { token: 'wgt_...' });
 * Replyze.open();
 * ```
 *
 * Calls made before the widget is ready wait and run, in order, once it is.
 */
export const Replyze: ReplyzePlugin = Object.defineProperty({ ...methods }, 'install', {
  value: install,
  enumerable: false,
}) as ReplyzePlugin;

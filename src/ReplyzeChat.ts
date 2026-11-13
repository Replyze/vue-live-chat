import { computed, defineComponent, onBeforeUnmount, onMounted, watch, type DefineComponent, type PropType } from 'vue';
import { EVENTS, configure, loaderConfig, methods, mountChat, syncUser, type LoaderConfig } from './core';
import type {
  ReplyzeEventName,
  ReplyzeIdentity,
  ReplyzeLoadStrategy,
  ReplyzeMessage,
  ReplyzePosition,
  ReplyzeSentMessage,
  ReplyzeTheme,
} from './types';

const props = {
  /** The widget token, `wgt_...`: Settings → Integrations → Install widget. Not a secret. */
  token: { type: String, required: true },
  /** The Replyze API. Default `https://client.replyze.chat`. */
  apiUrl: String,
  /** The chat's interface language (`"de"`, `"pt-BR"`, `"ar"`...), over the browser's and the widget settings. Follows changes. */
  language: String,
  /** `false` turns visitor tracking off (visitor cookie, page views, presence), e.g. until cookie consent. Follows changes. Default `true`. */
  tracking: { type: Boolean, default: undefined },
  /** Brand colour, `#1eabd2` or `rgb(...)`. Over the dashboard's setting. */
  color: String,
  /** The launcher's corner. */
  position: String as PropType<ReplyzePosition>,
  theme: String as PropType<ReplyzeTheme>,
  /** The assistant's name. */
  botName: String,
  /** The assistant's picture, an https URL. */
  botAvatar: String,
  /** The first message in a new chat. */
  welcomeMessage: String,
  /** The welcome card next to the launcher. */
  showGreetingTeaser: { type: Boolean, default: undefined },
  /** Seconds (0 to 300) before the welcome card shows. */
  autoOpenDelay: Number,
  /**
   * The signed-in user. `undefined` (default): not known, nothing happens.
   * `null`: nobody is signed in; a user identified before in this browser is forgotten (`reset()`).
   * A user: `identify()` once per page load, after a `reset()` when someone else was identified here.
   */
  user: { type: Object as PropType<ReplyzeIdentity | null>, default: undefined },
  /** When widget.js is requested. Default `lazyOnload` (after the page's load event, when idle). */
  strategy: String as PropType<ReplyzeLoadStrategy>,
  /** Where widget.js comes from. Default `https://cdn.replyze.chat/widget.js`. */
  scriptUrl: String,
  /** A Content-Security-Policy nonce for the script tag. */
  nonce: String,
} as const;

const emits = {
  /** The widget is running (also when it already was when this component mounted). */
  ready: () => true,
  open: () => true,
  close: () => true,
  /** The unread count changed. */
  unread: (count: number) => typeof count === 'number',
  'message:sent': (message: ReplyzeSentMessage) => !!message,
  'message:received': (message: ReplyzeMessage) => !!message,
  /** `identify()` went through; `verified` is true when the `user_hash` checked out. */
  identified: (result: { verified: boolean }) => !!result,
  reset: () => true,
};

function parseUser(key: string): ReplyzeIdentity | null | undefined {
  return key === 'undefined' ? undefined : (JSON.parse(key) as ReplyzeIdentity | null);
}

/**
 * Typed with the first eight DefineComponent parameters only: the
 * declaration file then fits the DefineComponent of Vue 3.3, 3.4 and 3.5
 * alike (a type inferred against 3.5 has more parameters than 3.3 and 3.4
 * accept).
 */
type ReplyzeChatComponent = DefineComponent<typeof props, {}, {}, {}, {}, {}, {}, typeof emits>;

/**
 * The Replyze live chat widget. Render it once, near the root of the app
 * (App.vue, or app.vue / a layout in Nuxt). It renders nothing itself: once
 * mounted, it loads https://cdn.replyze.chat/widget.js (once per page), and
 * the widget draws its launcher in a fixed-position shadow root. Its events
 * come out as Vue events: `@open`, `@unread`, `@message:received`...
 *
 * Unmounting it stops its listeners and leaves the widget running (it is one
 * per page); use `hide()` / `show()` from `useReplyze()` to take it off a page.
 */
export const ReplyzeChat = defineComponent({
  name: 'ReplyzeChat',
  props,
  emits,
  setup(props, { emit }) {
    const configKey = computed(() => JSON.stringify(loaderConfig(props)));
    const userKey = computed(() => (props.user === undefined ? 'undefined' : JSON.stringify(props.user)));
    let isMounted = false;
    let release: (() => void) | null = null;
    const stops: Array<() => void> = [];

    onMounted(() => {
      isMounted = true;
      release = mountChat();
      for (const event of EVENTS) {
        stops.push(methods.on(event, ((...args: unknown[]) => (emit as (e: ReplyzeEventName, ...a: unknown[]) => void)(event, ...args)) as never));
      }
      configure(JSON.parse(configKey.value) as LoaderConfig);
      syncUser(parseUser(userKey.value));
    });

    // Created here (not in onMounted) so they stop with the component; they only act once it is mounted.
    watch(configKey, (key) => {
      if (isMounted) configure(JSON.parse(key) as LoaderConfig);
    });
    watch(userKey, (key) => {
      if (isMounted) syncUser(parseUser(key));
    });

    onBeforeUnmount(() => {
      isMounted = false;
      for (const stop of stops.splice(0)) stop();
      release?.();
      release = null;
    });

    return () => null;
  },
}) as unknown as ReplyzeChatComponent;

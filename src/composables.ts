import { computed, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, ref, shallowRef, type Ref } from 'vue';
import { INITIAL_STATE, getState, methods, subscribe } from './core';
import type { ReplyzeEventHandler, ReplyzeEventName, ReplyzeMethods, ReplyzeState, ReplyzeStatus } from './types';

/** The widget's state for Vue: one ref for the page, fed by the loader once something in the browser asks for it. */
const live = shallowRef<ReplyzeState>(INITIAL_STATE);
let bridged = false;

function bridge(): void {
  if (bridged || typeof window === 'undefined') return;
  bridged = true;
  subscribe(() => {
    live.value = getState();
  });
  live.value = getState();
}

/** Tests only: forget the bridge (after the loader's resetForTests()). */
export function resetComposablesForTests(): void {
  bridged = false;
  live.value = INITIAL_STATE;
}

export interface UseReplyzeResult extends ReplyzeMethods {
  /** `idle`, `loading`, `ready` or `error`. */
  status: Readonly<Ref<ReplyzeStatus>>;
  /** The chat window is open. */
  isOpen: Readonly<Ref<boolean>>;
  /** Replies the visitor hasn't seen: the number on the launcher's badge. */
  unreadCount: Readonly<Ref<number>>;
}

/**
 * The widget's methods plus its state as read-only refs (`status`,
 * `isOpen`, `unreadCount`). Works in any component, store or plain module,
 * with no plugin or provide/inject needed: the widget is one per page.
 * Calls made before the widget is ready run once it is; on the server they
 * do nothing.
 *
 * In a component, the state reads as on the server (`idle`, closed, 0)
 * until the component is mounted, so a server-rendered page hydrates
 * without a mismatch.
 */
export function useReplyze(): UseReplyzeResult {
  bridge();
  let state: Readonly<Ref<ReplyzeState>> = live;
  if (getCurrentInstance() && typeof window !== 'undefined') {
    const mounted = ref(false);
    onMounted(() => {
      mounted.value = true;
    });
    state = computed(() => (mounted.value ? live.value : INITIAL_STATE));
  }
  return {
    ...methods,
    status: computed(() => state.value.status),
    isOpen: computed(() => state.value.isOpen),
    unreadCount: computed(() => state.value.unreadCount),
  };
}

/**
 * Listen to a widget event while the calling component (or effect scope)
 * lives; it stops listening when that is unmounted or stopped. Returns the
 * function that stops it earlier. Does nothing on the server.
 *
 * ```ts
 * useReplyzeEvent('message:received', (message) => console.log(message.content));
 * ```
 */
export function useReplyzeEvent<E extends ReplyzeEventName>(event: E, handler: ReplyzeEventHandler<E>): () => void {
  const stop = methods.on(event, handler);
  if (getCurrentScope()) onScopeDispose(stop);
  return stop;
}

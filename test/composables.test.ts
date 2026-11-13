import { defineComponent, effectScope, h, nextTick, ref, type Component } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Replyze, ReplyzeChat, useReplyze, useReplyzeEvent, type ReplyzeMessage } from '../src';
import { deliverScript, newPage, type FakeWidget } from './support/fakeWidget';

const wrappers: VueWrapper[] = [];
function render(...children: Component[]): VueWrapper {
  const Root = defineComponent({ render: () => children.map((c) => h(c)) });
  const wrapper = mount(Root, { attachTo: document.body });
  wrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => newPage());
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});

const Chat = defineComponent({ render: () => h(ReplyzeChat, { token: 'wgt_test', strategy: 'afterInteractive' }) });

const Launcher = defineComponent({
  setup() {
    const { isOpen, unreadCount, status, toggle } = useReplyze();
    return () => h('button', { type: 'button', onClick: toggle, 'data-status': status.value }, `${isOpen.value ? 'Close chat' : 'Chat'} (${unreadCount.value})`);
  },
});

function boot(...children: Component[]): FakeWidget {
  render(Chat, ...(children.length ? children : [Launcher]));
  return deliverScript()!;
}

function button(): HTMLButtonElement {
  return document.querySelector('button')!;
}

describe('useReplyze()', () => {
  it('re-renders on open, close and the unread count', async () => {
    const widget = boot();
    await nextTick();
    expect(button().textContent).toBe('Chat (0)');
    expect(button().dataset.status).toBe('ready');

    widget.receive('Hi there');
    widget.receive('Still there?');
    await nextTick();
    expect(button().textContent).toBe('Chat (2)');

    button().click();
    expect(widget.calls).toContainEqual(['toggle', []]);
    await nextTick();
    expect(button().textContent).toBe('Close chat (0)');

    button().click();
    await nextTick();
    expect(button().textContent).toBe('Chat (0)');
  });

  it('returns read-only refs that keep working when destructured', () => {
    let result!: ReturnType<typeof useReplyze>;
    const Probe = defineComponent({
      setup() {
        result = useReplyze();
        return () => null;
      },
    });
    const widget = boot(Probe);
    const { isOpen, unreadCount } = result;
    widget.receive('x');
    expect(unreadCount.value).toBe(1);
    widget.open();
    expect(isOpen.value).toBe(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    (isOpen as { value: boolean }).value = false;
    expect(isOpen.value).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('readonly'));
  });

  it('works outside components (a store, a module) with the live state', () => {
    const scope = effectScope();
    const result = scope.run(() => useReplyze())!;
    expect(result.status.value).toBe('idle');
    const widget = boot();
    expect(result.status.value).toBe('ready');
    widget.open();
    expect(result.isOpen.value).toBe(true);
    scope.stop();
  });

  it('passes every method through to window.Replyze with its arguments', () => {
    const widget = boot();
    const { show, hide, identify, setLanguage, sendMessage, setUser, setData, pushEvent, setTracking, openArticle } = useReplyze();
    show();
    hide();
    identify('ana@shop.example', 'Ana');
    identify({ user_id: '42', user_hash: 'f00' });
    setLanguage('pt-BR');
    sendMessage('Hello');
    setUser({ email: 'ana@shop.example', data: { plan: 'pro' } });
    setData({ plan: 'pro', seats: 3, trial: false, coupon: null });
    pushEvent('Signed up');
    pushEvent('Upgraded', { plan: 'pro' });
    setTracking(false);
    openArticle(12);
    expect(widget.calls).toEqual([
      ['show', []],
      ['hide', []],
      ['identify', ['ana@shop.example', 'Ana']],
      ['identify', [{ user_id: '42', user_hash: 'f00' }]],
      ['setLanguage', ['pt-BR']],
      ['sendMessage', ['Hello']],
      ['setUser', [{ email: 'ana@shop.example', data: { plan: 'pro' } }]],
      ['setData', [{ plan: 'pro', seats: 3, trial: false, coupon: null }]],
      ['pushEvent', ['Signed up']],
      ['pushEvent', ['Upgraded', { plan: 'pro' }]],
      ['setTracking', [false]],
      ['openArticle', [12]],
    ]);
  });

  it('passes plain copies, not reactive objects that could change later', () => {
    render(Chat);
    const data = ref({ plan: 'pro' });
    // Waits for the widget...
    Replyze.setData(data.value);
    // ...while the app changes the object.
    data.value.plan = 'free';
    const widget = deliverScript()!;
    expect(widget.calls).toEqual([['setData', [{ plan: 'pro' }]]]);
  });

  it('holds calls made before the widget runs and replays them in order, after listening', async () => {
    render(defineComponent({ render: () => h(ReplyzeChat, { token: 'wgt_test' }) }), Launcher);
    Replyze.setLanguage('de');
    Replyze.open();
    Replyze.pushEvent('Viewed pricing');
    await nextTick();
    expect(button().textContent).toBe('Chat (0)');

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const widget = deliverScript()!;
    expect(widget.calls).toEqual([
      ['setLanguage', ['de']],
      ['open', []],
      ['pushEvent', ['Viewed pricing']],
    ]);
    // The early open() reached the state, because the listeners came first.
    await nextTick();
    expect(button().textContent).toBe('Close chat (0)');
  });

  it('is idle on a page without <ReplyzeChat>, and calls wait', async () => {
    const Probe = defineComponent({
      setup() {
        const { status } = useReplyze();
        return () => h('span', status.value);
      },
    });
    const wrapper = render(Probe);
    await nextTick();
    expect(wrapper.text()).toBe('idle');
    expect(() => Replyze.open()).not.toThrow();
  });

  it('follows a widget loaded by a <script> snippet, without <ReplyzeChat>', async () => {
    const tag = document.createElement('script');
    tag.src = 'https://cdn.replyze.chat/widget.js';
    document.body.appendChild(tag);
    (window as unknown as { ReplyzeConfig: unknown }).ReplyzeConfig = { token: 'wgt_snippet' };
    render(Launcher);
    await nextTick();
    expect(button().dataset.status).toBe('loading');
    const widget = deliverScript(tag)!;
    await nextTick();
    expect(button().dataset.status).toBe('ready');
    widget.receive('Hi');
    await nextTick();
    expect(button().textContent).toBe('Chat (1)');
    expect(document.querySelectorAll('script')).toHaveLength(1);
  });

  it('reports a method the widget does not have instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    boot();
    delete (window as unknown as { Replyze: Record<string, unknown> }).Replyze.openArticle;
    expect(() => Replyze.openArticle(1)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('openArticle()'));
  });
});

describe('events', () => {
  it('on() returns an unsubscribe function and passes the arguments', () => {
    const widget = boot();
    const unread = vi.fn();
    const received = vi.fn();
    const stop = Replyze.on('unread', unread);
    Replyze.on('message:received', received);
    widget.receive('Hi');
    stop();
    widget.receive('Again');
    expect(unread.mock.calls).toEqual([[1]]);
    expect(received).toHaveBeenCalledTimes(2);
    expect((received.mock.calls[0][0] as ReplyzeMessage).content).toBe('Hi');
  });

  it('off() removes a listener', () => {
    const widget = boot();
    const opened = vi.fn();
    Replyze.on('open', opened);
    Replyze.off('open', opened);
    widget.open();
    expect(opened).not.toHaveBeenCalled();
  });

  it('listeners added before the widget loads hear its events', () => {
    const opened = vi.fn();
    const ready = vi.fn();
    Replyze.on('open', opened);
    Replyze.on('ready', ready);
    const widget = boot();
    widget.open();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('a listener for ready added after the widget started is called once, asynchronously', async () => {
    boot();
    const ready = vi.fn();
    Replyze.on('ready', ready);
    expect(ready).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not stop the others', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const widget = boot();
    const second = vi.fn();
    Replyze.on('close', () => {
      throw new Error('boom');
    });
    Replyze.on('close', second);
    widget.close();
    expect(second).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('useReplyzeEvent() listens while the component is mounted', async () => {
    const calls: string[] = [];
    const show = ref(true);
    const Listener = defineComponent({
      setup() {
        useReplyzeEvent('identified', ({ verified }) => calls.push(`verified:${verified}`));
        return () => null;
      },
    });
    render(Chat, defineComponent({ render: () => (show.value ? h(Listener) : null) }));
    const widget = deliverScript()!;
    widget.emit('identified', { verified: true });
    show.value = false;
    await nextTick();
    widget.emit('identified', { verified: false });
    expect(calls).toEqual(['verified:true']);
  });

  it('useReplyzeEvent() in an effect scope stops with the scope, or earlier with its return value', () => {
    const widget = boot();
    const scope = effectScope();
    const opened = vi.fn();
    const closed = vi.fn();
    let stopClosed!: () => void;
    scope.run(() => {
      useReplyzeEvent('open', opened);
      stopClosed = useReplyzeEvent('close', closed);
    });
    stopClosed();
    widget.open();
    widget.close();
    scope.stop();
    widget.open();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
  });
});

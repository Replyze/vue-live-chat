// @vitest-environment node
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Replyze, ReplyzeChat, useReplyze, useReplyzeEvent } from '../src';
import { listenerCountForTests } from '../src/core';

const Status = defineComponent({
  setup() {
    const { status, isOpen, unreadCount } = useReplyze();
    useReplyzeEvent('open', () => undefined);
    return () => h('p', `${status.value} ${isOpen.value} ${unreadCount.value}`);
  },
});

describe('server rendering', () => {
  it('renders nothing for the chat, reads the idle state and touches no browser globals', async () => {
    expect(typeof window).toBe('undefined');
    const app = createSSRApp({
      render: () => [h(ReplyzeChat, { token: 'wgt_test', user: { user_id: 1, user_hash: 'x' }, language: 'de' }), h(Status)],
    });
    app.use(Replyze, { token: 'wgt_test', strategy: 'afterInteractive' });
    const html = await renderToString(app);
    expect(html).toBe('<!--[--><!----><p>idle false 0</p><!--]-->');
  });

  it('keeps nothing between requests: methods and listeners are no-ops on the server', async () => {
    const handler = vi.fn();
    expect(() => {
      Replyze.open();
      Replyze.identify('ana@shop.example');
      Replyze.on('open', handler)();
    }).not.toThrow();
    // Many requests render a component that listens; none of the listeners is kept.
    for (let i = 0; i < 3; i++) await renderToString(createSSRApp(Status));
    expect(listenerCountForTests()).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });
});

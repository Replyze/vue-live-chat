/**
 * The package as an SFC template uses it: kebab-case props, `@message:received`,
 * and the refs from useReplyze() unwrapped in the template.
 */
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it } from 'vitest';
import TemplateApp from './fixtures/TemplateApp.vue';
import { deliverScript, newPage } from './support/fakeWidget';

let unmount: (() => void) | null = null;
beforeEach(() => newPage());
afterEach(() => unmount?.());

it('works from a <script setup> template', async () => {
  const wrapper = mount(TemplateApp, { attachTo: document.body });
  unmount = () => wrapper.unmount();
  expect((window as unknown as { ReplyzeConfig: unknown }).ReplyzeConfig).toEqual({
    token: 'wgt_template',
    overrides: { bot_name: 'Ava', show_greeting_teaser: false },
  });

  const widget = deliverScript()!;
  await nextTick();
  const button = wrapper.get('button');
  expect(button.attributes('data-status')).toBe('ready');
  expect(button.text()).toBe('Chat (0)');

  widget.receive('Hello from the team');
  await nextTick();
  expect(button.text()).toBe('Chat (1)');

  await button.trigger('click');
  expect(button.text()).toBe('Close chat (0)');

  wrapper.vm.user = { user_id: 7, user_hash: 'abc' };
  await nextTick();
  await Promise.resolve();
  expect(widget.calls).toContainEqual(['identify', [{ user_id: 7, user_hash: 'abc' }]]);
  expect(wrapper.vm.log).toEqual(['ready', 'received: Hello from the team', 'unread: 1', 'unread: 0', 'identified: true']);
});

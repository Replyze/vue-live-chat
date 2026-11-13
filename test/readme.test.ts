/**
 * The README's Vue snippets (test/fixtures/readme/*.vue: the same code, with
 * relative imports and strategy="afterInteractive" so no idle wait is
 * needed), mounted with the stand-in widget. `npm run typecheck` checks
 * their templates too.
 */
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Events from './fixtures/readme/Events.vue';
import HelpButton from './fixtures/readme/HelpButton.vue';
import CookieConsent from './fixtures/readme/CookieConsent.vue';
import { deliverScript, newPage } from './support/fakeWidget';

const wrappers: VueWrapper[] = [];
beforeEach(() => newPage());
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});

it('Events: @unread and @message:received handlers', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  wrappers.push(mount(Events));
  const widget = deliverScript()!;
  widget.receive('We are here');
  expect(document.title).toBe('(1) My shop');
  expect(log).toHaveBeenCalledWith('The team replied:', 'We are here');
  widget.open();
  expect(document.title).toBe('My shop');
});

it('Your own chat button: toggle and the unread count', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const Page = defineComponent({ render: () => [h(Events), h(HelpButton)] });
  const wrapper = mount(Page);
  wrappers.push(wrapper);
  const widget = deliverScript()!;
  widget.receive('Hi');
  await nextTick();
  expect(wrapper.get('button').text()).toBe('Help (1)');
  await wrapper.get('button').trigger('click');
  expect(widget.isOpen).toBe(true);
  expect(wrapper.get('button').text()).toBe('Help');
});

it('Cookie consent: :tracking follows the consent', async () => {
  const wrapper = mount(CookieConsent);
  wrappers.push(wrapper);
  expect((window as unknown as { ReplyzeConfig: unknown }).ReplyzeConfig).toEqual({ token: 'wgt_YOUR_TOKEN', tracking: false });
  const widget = deliverScript()!;
  (wrapper.vm as unknown as { consent: { analytics: boolean } }).consent.analytics = true;
  await nextTick();
  expect(widget.calls).toEqual([['setTracking', [true]]]);
});

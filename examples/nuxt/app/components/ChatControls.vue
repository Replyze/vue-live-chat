<script setup lang="ts">
import { ref } from 'vue';
import { useReplyze, useReplyzeEvent } from '@replyze/vue';

const { status, isOpen, unreadCount, open, close, toggle, show, hide, setLanguage, pushEvent } = useReplyze();

const log = ref<string[]>([]);
const note = (line: string) => {
  log.value = [line, ...log.value].slice(0, 8);
};

useReplyzeEvent('ready', () => note('ready'));
useReplyzeEvent('open', () => note('open'));
useReplyzeEvent('close', () => note('close'));
useReplyzeEvent('unread', (count) => note(`unread: ${count}`));
useReplyzeEvent('message:received', (message) => note(`reply from ${message.sender_name ?? message.sender}`));
useReplyzeEvent('identified', ({ verified }) => note(`identified (verified: ${verified})`));
useReplyzeEvent('reset', () => note('reset'));
</script>

<template>
  <section>
    <p>
      Widget: <strong data-testid="status">{{ status }}</strong> · chat
      <strong data-testid="is-open">{{ isOpen ? 'open' : 'closed' }}</strong>
    </p>
    <button type="button" data-testid="help" @click="toggle">Help{{ unreadCount > 0 ? ` (${unreadCount})` : '' }}</button>
    <button type="button" data-testid="open" @click="open">Open</button>
    <button type="button" data-testid="close" @click="close">Close</button>
    <button type="button" data-testid="hide" @click="hide">Hide</button>
    <button type="button" data-testid="show" @click="show">Show</button>
    <button type="button" data-testid="german" @click="setLanguage('de')">Deutsch</button>
    <button type="button" data-testid="event" @click="pushEvent('Clicked upgrade', { plan: 'pro' })">Push an event</button>
    <ol data-testid="events">
      <li v-for="(line, i) in log" :key="`${i}-${line}`">{{ line }}</li>
    </ol>
  </section>
</template>

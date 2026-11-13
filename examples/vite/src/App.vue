<script setup lang="ts">
import { ref } from 'vue';
import { useReplyze, useReplyzeEvent } from '@replyze/vue';

const { status, isOpen, unreadCount, toggle, setLanguage } = useReplyze();

const log = ref<string[]>([]);
useReplyzeEvent('ready', () => log.value.unshift('ready'));
useReplyzeEvent('open', () => log.value.unshift('open'));
useReplyzeEvent('close', () => log.value.unshift('close'));
useReplyzeEvent('unread', (count) => log.value.unshift(`unread: ${count}`));
</script>

<template>
  <main style="max-width: 720px; margin: 0 auto; padding: 32px 16px; font-family: system-ui, sans-serif">
    <h1>Replyze chat in Vue</h1>
    <p>
      The plugin is installed in <code>src/main.ts</code>. Widget: <strong data-testid="status">{{ status }}</strong> · chat
      <strong data-testid="is-open">{{ isOpen ? 'open' : 'closed' }}</strong>
    </p>
    <button type="button" data-testid="help" @click="toggle">Help{{ unreadCount > 0 ? ` (${unreadCount})` : '' }}</button>
    <button type="button" data-testid="german" @click="setLanguage('de')">Deutsch</button>
    <ol data-testid="events">
      <li v-for="(line, i) in log" :key="`${i}-${line}`">{{ line }}</li>
    </ol>
  </main>
</template>

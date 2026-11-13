<script setup lang="ts">
import { ref } from 'vue';
import { ReplyzeChat, useReplyze, type ReplyzeIdentity, type ReplyzeMessage } from '../../src';

const user = ref<ReplyzeIdentity | null | undefined>(undefined);
const log = ref<string[]>([]);
const { status, isOpen, unreadCount, toggle } = useReplyze();

function onReceived(message: ReplyzeMessage) {
  log.value.push(`received: ${message.content}`);
}

defineExpose({ user, log });
</script>

<template>
  <ReplyzeChat
    token="wgt_template"
    bot-name="Ava"
    :show-greeting-teaser="false"
    strategy="afterInteractive"
    :user="user"
    @ready="log.push('ready')"
    @unread="(count) => log.push(`unread: ${count}`)"
    @message:received="onReceived"
    @identified="({ verified }) => log.push(`identified: ${verified}`)"
  />
  <button type="button" :data-status="status" @click="toggle">{{ isOpen ? 'Close chat' : 'Chat' }} ({{ unreadCount }})</button>
</template>

<script setup lang="ts">
import { ReplyzeChat, type ReplyzeMessage } from '../../../src';

function onUnread(count: number) {
  document.title = count > 0 ? `(${count}) My shop` : 'My shop';
}

function onReply(message: ReplyzeMessage) {
  if (message.sender === 'agent') console.log('The team replied:', message.content);
}
</script>

<template>
  <ReplyzeChat token="wgt_YOUR_TOKEN" strategy="afterInteractive" @unread="onUnread" @message:received="onReply" />
</template>

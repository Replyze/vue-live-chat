<script setup lang="ts">
import { reactive } from 'vue';
import { ReplyzeChat } from '../../../src';

const token = 'wgt_YOUR_TOKEN';
const consent = reactive({ analytics: false });
defineExpose({ consent });
</script>

<template>
  <ReplyzeChat :token="token" :tracking="consent.analytics" strategy="afterInteractive" />
</template>

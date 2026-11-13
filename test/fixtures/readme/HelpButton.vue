<script setup lang="ts">
import { useReplyze } from '../../../src';

const { toggle, unreadCount } = useReplyze();
</script>

<template>
  <button type="button" @click="toggle">Help<template v-if="unreadCount > 0"> ({{ unreadCount }})</template></button>
</template>

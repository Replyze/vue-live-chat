<script setup lang="ts">
import { computed } from 'vue';
import { ReplyzeChat, type ReplyzeIdentity } from '@replyze/vue';

const config = useRuntimeConfig();

// The signed-in user, signed on the server (server/api/replyze-identity.get.ts).
// undefined until it has loaded, null when signed out.
const { data, refresh } = await useFetch<{ user: ReplyzeIdentity | null }>('/api/replyze-identity', {
  headers: useRequestHeaders(['cookie']),
});
const user = computed(() => data.value?.user);

async function signIn() {
  await $fetch('/api/demo-session', { method: 'POST' });
  await refresh();
}

async function signOut() {
  await $fetch('/api/demo-session', { method: 'DELETE' });
  await refresh();
}
</script>

<template>
  <main class="page">
    <h1>Replyze chat in Nuxt</h1>
    <p>
      <code>&lt;ReplyzeChat&gt;</code> is in <code>app/app.vue</code>. The buttons use <code>useReplyze()</code>; the log
      uses <code>useReplyzeEvent()</code>.
    </p>

    <ChatControls />

    <section>
      <h2>Signed-in user</h2>
      <p v-if="user" data-testid="user">
        {{ user.name }} ({{ user.email }}){{ user.user_hash ? ', signed with user_hash' : ', no identity secret set' }}
      </p>
      <p v-else data-testid="user">Nobody is signed in.</p>
      <button v-if="user" type="button" data-testid="sign-out" @click="signOut">Sign out</button>
      <button v-else type="button" data-testid="sign-in" @click="signIn">Sign in (demo)</button>
    </section>

    <ReplyzeChat :token="config.public.replyzeToken" :user="user" />
  </main>
</template>

<style>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}
.page button {
  margin: 0 8px 8px 0;
}
</style>

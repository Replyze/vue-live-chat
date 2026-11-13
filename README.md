<p align="center">
  <a href="https://replyze.chat/?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Replyze/.github/main/assets/logo-on-dark.png">
      <img src="https://raw.githubusercontent.com/Replyze/.github/main/assets/logo-on-light.png" alt="Replyze" height="48">
    </picture>
  </a>
</p>

# Vue live chat widget: AI support chat for Vue 3 and Nuxt

`@replyze/vue` puts the [Replyze](https://replyze.chat/?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat) live chat widget in a Vue 3 or Nuxt 3/4 app: a floating launcher, an AI chatbot that answers from your knowledge base and hands over to your team, and live chat with your team. Add one `<ReplyzeChat>` component or `app.use(Replyze, { token })`. The `useReplyze()` composable lets your own buttons open the chat and show the unread count, the widget's events are typed Vue events, and identity verification for signed-in users comes with a server helper. It is safe to render on the server, and server-rendered pages hydrate without a mismatch.

**[Create a free account](https://client.replyze.chat/register?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat&utm_content=cta-top)** · [Live demo](https://replyze.chat/?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat&utm_content=live-demo) · [Docs](https://github.com/Replyze/replyze)

Replyze brings web chat, email, WhatsApp and Telegram into one inbox for your team (Messenger and Instagram are in beta). This package adds the web chat to a Vue app. The live demo is replyze.chat itself: the chat bubble in the bottom-right corner is the same widget.

## Quickstart

1. **Get your widget token.** [Create a free account](https://client.replyze.chat/register?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat&utm_content=quickstart), then copy the token (`wgt_...`) from **Settings → Integrations → Install widget**.
2. **Install the package** from GitHub:
   ```sh
   npm install github:Replyze/vue-live-chat
   ```
3. **Add `<ReplyzeChat>` once**, next to the rest of your root component: `App.vue` in Vue, `app.vue` in Nuxt:
   ```vue
   <script setup lang="ts">
   import { ReplyzeChat } from '@replyze/vue';
   </script>

   <template>
     <!-- your app: <RouterView />, <NuxtPage />... -->
     <ReplyzeChat token="wgt_YOUR_TOKEN" />
   </template>
   ```

Once the page has loaded, the chat launcher appears in the bottom corner. In Nuxt, keep the token in `runtimeConfig`: see [Nuxt](#nuxt-3-and-4).

## Contents

[Install](#install) · [Vue 3 and Vite](#vue-3-and-vite) · [Nuxt](#nuxt-3-and-4) · [Your widget token](#your-widget-token-and-allowed-domains) · [Options](#options) · [useReplyze()](#usereplyze) · [Events](#events) · [Outside components](#outside-components) · [Identity verification](#identity-verification) · [Cookie consent](#cookie-consent) · [How it works](#how-it-works) · [TypeScript](#typescript) · [FAQ](#faq) · [Development](#development)

## Install

`@replyze/vue` is not on the npm registry yet. Install it from GitHub:

```sh
npm install github:Replyze/vue-live-chat
```

You import it as `@replyze/vue`. npm builds the package while it installs (its `prepare` script runs `tsup`), so the install needs git and takes a few seconds longer than a package from the registry. Pin a commit or tag with `github:Replyze/vue-live-chat#<ref>`.

After the first npm release (not yet), the registry install will be:

```sh
npm install @replyze/vue
```

Requirements: Vue 3.3 or newer (peer dependency). Nuxt 3 or 4. The identity helper in `@replyze/vue/server` needs Node 20 or newer (or another runtime with Web Crypto). You also need a Replyze account ([sign up](https://client.replyze.chat/register?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat&utm_content=install)).

## Vue 3 and Vite

Two ways to add the chat; use one.

**The component**, in `App.vue`. Its props can come from your app's state, and it takes the signed-in [`user`](#identity-verification):

```vue
<script setup lang="ts">
import { ReplyzeChat } from '@replyze/vue';
</script>

<template>
  <RouterView />
  <ReplyzeChat :token="token" />
</template>
```

**The plugin**, in `src/main.ts`, when the chat needs no state from your components:

```ts
import { createApp } from 'vue';
import { Replyze } from '@replyze/vue';
import App from './App.vue';

createApp(App)
  .use(Replyze, { token: import.meta.env.VITE_REPLYZE_TOKEN })
  .mount('#app');
```

```sh
# .env.local
VITE_REPLYZE_TOKEN=wgt_YOUR_TOKEN
```

The plugin takes the same [options](#options) as the component's props, except `user`, and reads them once. Render the component once, near the root, so it stays mounted while people move between pages. The widget notices client-side route changes by itself. A Vite app with the plugin is in [`examples/vite`](examples/vite).

### Your own chat button

```vue
<script setup lang="ts">
import { useReplyze } from '@replyze/vue';

const { toggle, unreadCount } = useReplyze();
</script>

<template>
  <button type="button" @click="toggle">Help<template v-if="unreadCount > 0"> ({{ unreadCount }})</template></button>
</template>
```

`useReplyze()` needs no plugin or provider. Calls made before the widget has loaded wait and run as soon as it starts.

## Nuxt 3 and 4

The component renders nothing on the server and loads the widget in the browser once it is mounted, so it goes straight into `app.vue` (or a layout). No `<ClientOnly>` and no Nuxt module are needed.

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    replyzeIdentitySecret: '', // server only, from NUXT_REPLYZE_IDENTITY_SECRET (optional, see Identity verification)
    public: {
      replyzeToken: '', // from NUXT_PUBLIC_REPLYZE_TOKEN
    },
  },
});
```

`app.vue` (`app/app.vue` in Nuxt 4):

```vue
<script setup lang="ts">
import { ReplyzeChat } from '@replyze/vue';

const config = useRuntimeConfig();
</script>

<template>
  <NuxtPage />
  <ReplyzeChat :token="config.public.replyzeToken" />
</template>
```

```sh
# .env
NUXT_PUBLIC_REPLYZE_TOKEN=wgt_YOUR_TOKEN
```

`nuxt dev` reads `.env`; the built server (`node .output/server/index.mjs`) does not, so in production set `NUXT_PUBLIC_REPLYZE_TOKEN` in your host's environment. Without it the token is empty and the console says `[Replyze] No widget token`.

**Or a client plugin**, `plugins/replyze.client.ts` (`app/plugins/` in Nuxt 4), instead of the component:

```ts
import { Replyze } from '@replyze/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Replyze, { token: useRuntimeConfig().public.replyzeToken });
});
```

`useReplyze()` and `useReplyzeEvent()` work in pages and components as in Vue. During hydration `useReplyze()` reads as it did on the server (`idle`, closed, 0) and switches to the widget's state once the component is mounted, so there is no hydration mismatch.

A full Nuxt 4 app is in [`examples/nuxt`](examples/nuxt): the chat in `app.vue`, buttons and an event log, and a server route that signs the user for identity verification.

## Your widget token and allowed domains

- **Token.** The widget token (`wgt_...`) is in the [dashboard](https://client.replyze.chat/?utm_source=github&utm_medium=referral&utm_campaign=vue-live-chat) under **Settings → Integrations → Install widget**. It is not a secret: it is in your page for anyone to see and only lets the chat talk to your workspace. API keys (`rpz_live_...`) are secrets; the package refuses to load with one and says so in the console.
- **Allowed domains.** **Settings → Chat Widget** has the list of sites that may show the widget. An empty list allows every site. With entries, the host must match: `example.com` doesn't cover `www.example.com`; `*.example.com` covers both. While you develop, add `localhost`. On a domain that isn't allowed, the console says `[Replyze] Widget blocked: this domain (...) is not in the widget's allowed-domains list`.

## Options

The props of `<ReplyzeChat>` and the options of `app.use(Replyze, options)`. In templates, write them in kebab-case if you like: `bot-name`, `welcome-message`, `auto-open-delay`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `token` | `string` | required | The widget token, `wgt_...` |
| `user` | `ReplyzeIdentity \| null` | `undefined` | Component only. The signed-in user: see [Identity verification](#identity-verification) |
| `language` | `string` | the browser's, or the widget's setting | The chat's interface language: `"de"`, `"pt-BR"`, `"ar"`... The widget speaks English, Serbian, German, Spanish, French, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Arabic, Chinese, Japanese, Hebrew and Persian. On the component, changes apply live |
| `tracking` | `boolean` | `true` | `false` turns off visitor tracking: no visitor cookie, page views or presence on the Visitors page. The chat works either way. On the component, changes apply live |
| `color` | `string` | the dashboard's | Brand colour, `"#1eabd2"` or `"rgb(...)"` |
| `position` | `"bottom_left" \| "bottom_right"` | the dashboard's | The launcher's corner |
| `theme` | `"light" \| "dark"` | the dashboard's | |
| `botName` | `string` | the dashboard's | The assistant's name |
| `botAvatar` | `string` | the dashboard's | The assistant's picture, an https URL |
| `welcomeMessage` | `string` | the dashboard's | The welcome message |
| `showGreetingTeaser` | `boolean` | the dashboard's | The welcome card next to the launcher |
| `autoOpenDelay` | `number` | the dashboard's | Seconds (0 to 300) before the welcome card shows |
| `strategy` | `"lazyOnload" \| "afterInteractive"` | `"lazyOnload"` | When `widget.js` is requested: after the page's `load` event when the browser is idle (at most 3 seconds later), or right away (the component: when it is mounted; the plugin: when it is installed) |
| `apiUrl` | `string` | `https://client.replyze.chat` | The Replyze API. Only for a staging or local backend |
| `scriptUrl` | `string` | `https://cdn.replyze.chat/widget.js` | Where `widget.js` comes from |
| `nonce` | `string` | | A Content-Security-Policy nonce for the script tag |

The look options (`color` to `autoOpenDelay`) win over the dashboard's widget settings; a value that doesn't fit (a colour that isn't one, an `http:` picture) is ignored by the widget. When `tracking` and `showGreetingTeaser` are not given, the widget's own setting applies. `token`, `apiUrl`, `scriptUrl` and the look options are read once, when the widget loads; if the component's props change later, the console says the change applies on the next page load. `language` and `tracking` follow the component's props through `setLanguage()` and `setTracking()`.

## useReplyze()

```ts
const { status, isOpen, unreadCount, open, close, toggle, identify, reset, on } = useReplyze();
```

**State**, as read-only refs (they stay reactive when destructured; templates unwrap them):

| | Type | |
| --- | --- | --- |
| `status` | `Ref<"idle" \| "loading" \| "ready" \| "error">` | `idle`: nothing has asked for the widget yet. `loading`: scheduled or downloading. `ready`: running. `error`: `widget.js` failed to load (network, ad blocker, Content-Security-Policy) or the widget didn't start; the console says why |
| `isOpen` | `Ref<boolean>` | The chat window is open |
| `unreadCount` | `Ref<number>` | Replies the visitor hasn't seen: the number on the launcher's badge |

**Methods**. They are the widget's own [JavaScript API](https://github.com/Replyze/replyze#2-javascript-api), with the same arguments:

| Method | What it does |
| --- | --- |
| `open()` / `close()` / `toggle()` | Open, close or toggle the chat window |
| `show()` / `hide()` | Show or hide the launcher and the chat. The widget keeps running while hidden. After `show()`, the widget shows on every page, whatever its page rules in the dashboard say |
| `identify(email, name?)` | Who the visitor is |
| `identify({ user_id, email, name, user_hash })` | A signed-in user, verified with `user_hash`: see [Identity verification](#identity-verification) |
| `reset()` | The visitor signed out: forget them (chat, contact, visitor cookie). The next chat starts as a new visitor |
| `setLanguage(language)` | The chat's interface language, over the browser's and the widget settings |
| `setUser({ email, name, data })` | Name and email, plus custom data in `data` |
| `setData({ plan: 'pro', seats: 3 })` | Custom data on the visitor's contact: text, numbers, `true`/`false`, or `null` to remove a key. Keys that match a contact field fill it; others are kept as extra data. Up to 50 keys |
| `pushEvent('Upgraded', { plan: 'pro' })` | An event on the visitor's timeline in the inbox, with the page it happened on. Names are 1 to 64 characters |
| `sendMessage(text)` | Send a message as the visitor |
| `setTracking(allowed)` | Turn visitor tracking on or off |
| `openArticle(id)` | Open the widget on a help article (the widget needs its Home or Help tab) |
| `on(event, handler)` | Listen to an [event](#events). Returns a function that stops listening |
| `off(event, handler)` | Stop listening |

Calls made before the widget runs wait in order (up to 100) and run once it does. Objects you pass (a `reactive()` one too) are copied at the time of the call. On the server the methods do nothing.

## Events

| Event | When | The handler gets |
| --- | --- | --- |
| `ready` | The widget is running. A handler added later is still called, once | nothing |
| `open` / `close` | The chat window opened or closed | nothing |
| `unread` | The unread count changed | `count: number` |
| `message:sent` | The visitor sent a message or a file | `{ text }` (`{ text, form: true }` from the contact form shown when nobody can answer), or `{ file }` with the file's name |
| `message:received` | A reply arrived from the AI or the team | `ReplyzeMessage`: `id`, `content`, `sender` (`"bot"` for the AI or a chatbot flow, `"agent"` for a person), `sender_name`, `created_at`, `attachments`... |
| `identified` | `identify()` went through | `{ verified }`: `true` when the `user_hash` checked out |
| `reset` | `reset()` finished | nothing |

On the component, as Vue events:

```vue
<script setup lang="ts">
import { ReplyzeChat, type ReplyzeMessage } from '@replyze/vue';

function onUnread(count: number) {
  document.title = count > 0 ? `(${count}) My shop` : 'My shop';
}

function onReply(message: ReplyzeMessage) {
  if (message.sender === 'agent') console.log('The team replied:', message.content);
}
</script>

<template>
  <ReplyzeChat token="wgt_YOUR_TOKEN" @unread="onUnread" @message:received="onReply" />
</template>
```

In any component, `useReplyzeEvent` listens for as long as the component is mounted (or the effect scope lives):

```ts
import { useReplyzeEvent } from '@replyze/vue';

useReplyzeEvent('message:sent', (message) => console.log('The visitor sent', message));
useReplyzeEvent('identified', ({ verified }) => console.log('verified:', verified));
```

Or `on()`, which returns its own unsubscribe.

## Outside components

The same methods are on the `Replyze` object, for Pinia stores, router guards and auth callbacks:

```ts
import { Replyze } from '@replyze/vue';

router.afterEach((to) => {
  if (to.path === '/pricing') Replyze.pushEvent('Viewed pricing');
});
```

`useReplyze()` also works outside components (in a Pinia setup store, for example): its refs follow the widget from the start.

## Identity verification

Without verification, `identify()` only labels the visitor. With it, a signed-in user of your app is the same contact on every device and browser, with their past conversations, marked as verified in the inbox, and nobody can chat as someone else by calling `identify()` with their email.

**How Replyze checks it** (`WidgetIdentity` in the Replyze backend):

- `user_hash` is the hex **HMAC-SHA256** of the user's id, keyed with your widget's **identity secret**.
- The id is signed as a string without surrounding spaces, so `42` and `"42"` give the same hash. A user without an id is signed by their email, trimmed and in lower case.
- The server compares the hash in constant time. A valid one makes the visitor that user's verified contact. An invalid one is refused and changes nothing; the console says `[Replyze] Failed to identify user`.
- With verification on, an `identify()` with a `user_id` but no valid `user_hash` is refused. With verification off, an `identify()` that carries a `user_hash` is refused too, so send the hash only while verification is on.

**1. Turn it on.** In **Settings → Chat Widget → Identity** (owners and admins), turn on identity verification and copy the secret. Keep it on your server: in Nuxt, in `runtimeConfig` outside `public` (`NUXT_REPLYZE_IDENTITY_SECRET`). Anyone with it can sign in as any of your users in the chat.

**2. Sign on the server.** `@replyze/vue/server` has the signing function. A Nuxt server route, `server/api/replyze-identity.get.ts`:

```ts
import { createUserHash } from '@replyze/vue/server';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const user = await getCurrentUser(event); // your auth: { id, email, name } or null
  if (!user) return { user: null };
  const user_hash = await createUserHash(useRuntimeConfig(event).replyzeIdentitySecret, { user_id: user.id });
  return { user: { user_id: user.id, email: user.email, name: user.name, user_hash } };
});
```

`createUserHash(secret, { email })` signs a user without an id. It uses only Web Crypto (`crypto.subtle`), so it runs in Node 20 and newer, Nuxt's edge presets, Bun, Deno and Cloudflare Workers. Never import it in browser code.

**3. Pass the user to the chat**, in `app.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { ReplyzeChat, type ReplyzeIdentity } from '@replyze/vue';

const config = useRuntimeConfig();
const { data, refresh } = await useFetch<{ user: ReplyzeIdentity | null }>('/api/replyze-identity', {
  headers: useRequestHeaders(['cookie']),
});
const user = computed(() => data.value?.user); // undefined while loading, null when signed out
// After your app signs someone in or out: await refresh()
</script>

<template>
  <NuxtPage />
  <ReplyzeChat :token="config.public.replyzeToken" :user="user" />
</template>
```

The `user` prop takes three kinds of value:

| `user` | What happens |
| --- | --- |
| `undefined` (not passed) | Nothing. Use it while your auth is still loading |
| `null` | Nobody is signed in. If this browser identified a user through the prop before, even on an earlier page load, the chat calls `reset()`, so the next person on a shared computer starts fresh |
| `{ user_id, email, name, user_hash }` | `identify()`, once per page load and again when a field changes. If another user was identified in this browser before, `reset()` comes first |

In a Vue app without Nuxt, fetch the same object from your backend. Or call `identify({ user_id, email, name, user_hash })` after sign-in and `reset()` after sign-out yourself.

**Node without this package** (Express, a Lambda), the same signature with `node:crypto`:

```js
const crypto = require('node:crypto');

function replyzeUserHash(secret, { user_id, email }) {
  const id = user_id == null ? '' : String(user_id).trim();
  const subject = id !== '' ? id : String(email || '').trim().toLowerCase();
  return crypto.createHmac('sha256', secret).update(subject).digest('hex');
}
```

Check your server code against this test vector (the secret is made up):

| Secret | Signed | `user_hash` |
| --- | --- | --- |
| `f3a1c9e07b2d4e68a5c1d9b3e7f20486a9c3e5d7f1b3a5c7e9d1f3b5a7c9e1d3` | user id `42` | `61b4b465a57ec25065d5a3b377329c00ab8e1c5562756729d26d880f39d8ec13` |
| same | email ` Jane@Example.com ` (no id) | `74baeda7d2f63e1df51c7aeea059bcf644fdca57ec0fcaba9a0f7b0e1b5eaaf9` |

Python and PHP versions: [Replyze/replyze, Identity verification](https://github.com/Replyze/replyze#3-identity-verification).

## Cookie consent

Visitor tracking (the visitor cookie, page views and presence) can wait for consent. The chat works either way:

```vue
<ReplyzeChat :token="token" :tracking="consent.analytics" />
```

When the prop changes, the package calls `setTracking()`. Turning it off also removes the visitor cookie (`rz_track_id`) and its stored copy.

## How it works

- **One widget per page.** The first `<ReplyzeChat>` (or the plugin) sets `window.ReplyzeConfig` and adds one `<script async>` for `https://cdn.replyze.chat/widget.js` to `<head>`. More instances, re-renders, unmounting and mounting again don't add another. With `lazyOnload`, a component unmounted (or an app unmounted, Vue 3.5+) before the script was due doesn't request it at all.
- **Unmounting doesn't remove the chat.** It stops the component's listeners; the widget has no "destroy" in its public API and is meant to live as long as the page, so it stays. To take it off some pages, see the FAQ.
- **A snippet already on the page.** If `widget.js` is already there (a `<script>` snippet, a tag manager), the package uses that widget instead of loading a second one, and applies `language` and `tracking` with `setLanguage()` and `setTracking()`. `useReplyze()` follows such a widget even without `<ReplyzeChat>`. A widget that was already open when the package found it reads as closed until its next `open` or `close`.
- **Calls before it runs.** Method calls wait in the package and run in order once the widget is running, after the package has subscribed to its events, so an early `open()` still shows in `isOpen`.
- **`ready`.** The widget emits its own `ready` event while it starts, before any listener can exist, so this package emits `ready` itself when `window.Replyze` is running.
- **Server rendering.** Nothing touches `window` during setup or render, and nothing is kept between requests: on the server the methods and `on()` do nothing.
- **The `user` prop** keeps a short fingerprint of who it identified in `localStorage` (`replyze-vue:user`), not their id or email, so that after a sign-out with a full page load it can still call `reset()`.
- **Size.** The package adds about 4 KB gzipped (9.4 KB minified) to your JavaScript. `widget.js` is a separate file of about 113 KB compressed (476 KB uncompressed) from Replyze's CDN, cached by the browser for 4 hours. The widget draws everything inside one shadow root, over the page.

## TypeScript

The package is written in TypeScript and ships its types for both the ESM and the CommonJS build. In templates, props and events are typed for Volar and `vue-tsc`: a wrong `position` or a string `auto-open-delay` is a type error. Exported types: `ReplyzeChatProps`, `ReplyzeOptions`, `ReplyzePlugin`, `UseReplyzeResult`, `ReplyzeMethods`, `ReplyzeState`, `ReplyzeStatus`, `ReplyzeIdentity`, `ReplyzeUser`, `ReplyzeData`, `ReplyzeDataValue`, `ReplyzeEventMap`, `ReplyzeEventName`, `ReplyzeEventHandler`, `ReplyzeMessage`, `ReplyzeAttachment`, `ReplyzeSentMessage`, `ReplyzePosition`, `ReplyzeTheme`, `ReplyzeLoadStrategy`; from `@replyze/vue/server`, `ReplyzeUserToSign`.

```ts
useReplyzeEvent('unread', (count) => {});             // count: number
useReplyzeEvent('identified', ({ verified }) => {});  // verified: boolean
useReplyzeEvent('message:received', (message) => {}); // message: ReplyzeMessage
```

## FAQ

**Is there a Nuxt module?** Not needed. The component works in `app.vue` with server rendering, and a client plugin covers the rest (see [Nuxt](#nuxt-3-and-4)).

**How do I hide the chat on some pages?** In the dashboard: **Settings → Chat Widget → Launcher**, "Pages the widget shows on". Or from code, `hide()` and `show()` (for example in a router guard). After `show()`, the widget shows everywhere regardless of the page rules, so use one or the other.

**Can I use my own button instead of the launcher?** Call `toggle()` or `open()` from it and show `unreadCount`. The widget's launcher stays on desktop. On phones the dashboard can hide it: **Settings → Chat Widget → Launcher**, "Hide the launcher on phones".

**The chat doesn't appear.** Check `status` from `useReplyze()` and the browser console:

- `error` with "Could not load https://cdn.replyze.chat/widget.js": a network error, an ad blocker, or your Content-Security-Policy.
- `ready` with "Widget blocked: this domain ... is not in the widget's allowed-domains list": add the domain (or `localhost`) in **Settings → Chat Widget**.
- `idle`: no `<ReplyzeChat>` with a token was mounted and the plugin wasn't installed with one. An empty token gives "No widget token" in the console; in Nuxt, check that `NUXT_PUBLIC_REPLYZE_TOKEN` is set where the app runs.
- `ready`, but the launcher has the default colour and the console shows a 404 for `/api/w/<token>/config`: the token is wrong or was deleted. Copy it again from **Settings → Integrations → Install widget**.

**What does my Content-Security-Policy need?** These sources:

```
script-src  https://cdn.replyze.chat
connect-src https://client.replyze.chat wss://client.replyze.chat
style-src   'unsafe-inline'
img-src     https: data: blob:
media-src   https://client.replyze.chat data: blob:
```

`style-src 'unsafe-inline'` because the widget's styles live in its shadow root; `blob:` for the preview of a picture or a voice message the visitor is about to send; `media-src https://client.replyze.chat` to play voice messages. The [Content-Security-Policy table](https://github.com/Replyze/add-live-chat-to-website#content-security-policy) explains every source. With a nonce-based `script-src`, pass the nonce: `<ReplyzeChat :nonce="nonce" />`.

**Can I change the token, or show two workspaces' chats?** One widget runs per page, and the token is read when it loads. A different token takes effect on the next full page load.

**Options API?** Import `Replyze` and call its methods (`Replyze.open()`), or call `useReplyze()` in `setup()`. `<ReplyzeChat>` works in any template.

**React, React Native or Flutter?** Use [react-live-chat](https://github.com/Replyze/react-live-chat), [react-native-live-chat](https://github.com/Replyze/react-native-live-chat) or [flutter-live-chat](https://github.com/Replyze/flutter-live-chat).

## Development

```sh
npm install          # also builds dist/
npm test             # unit tests: vitest, jsdom and Vue Test Utils, with a stand-in for widget.js; SSR and hydration
npm run test:widget  # the package against the real widget.js (downloads cdn.replyze.chat/widget.js; only the Replyze API is faked)
npm run typecheck    # vue-tsc
npm run build        # dist/: ESM, CommonJS and .d.ts
npm run test:types   # the built .d.ts files compiled as an app sees them (after build)
```

`npm run test:widget` takes `REPLYZE_WIDGET_JS` (a local `widget.js`) or `REPLYZE_WIDGET_URL` to test another build. The examples install this package from `../..`: run `npm install` in the root first, then in `examples/nuxt` or `examples/vite`.

CI runs the unit tests and the type test on Vue 3.3 and 3.5, the real-widget tests, the package checks (`npm pack --dry-run`, [publint](https://publint.dev), [Are the Types Wrong](https://arethetypeswrong.github.io)) and builds both examples. Changes are listed in [CHANGELOG.md](CHANGELOG.md); how a version is released is in [RELEASING.md](RELEASING.md).

**What we ran (November 2026):** the unit tests (70) and the real-widget tests (5) on Vue 3.5 and Vue 3.3; the built type declarations against Vue 3.3, 3.4 and 3.5 with `skipLibCheck` off; `nuxt build` of the example on Nuxt 4.6 and on Nuxt 3.21; a Vite 7 build of the Vite example; and in Chromium, with the production `widget.js` from `cdn.replyze.chat` and the Replyze API answered by the test (nothing reached production): the Nuxt example as a production build and in `nuxt dev` (no hydration warnings, no console errors), with a call queued before the widget ran, open, close, toggle, hide, show, `setLanguage()`, the demo sign-in (the `user_hash` from the server route reached `identify`), `pushEvent()` and sign-out (`reset`); the Nuxt client-plugin variant; and the Vite example with the plugin.

## More from Replyze

| Repository | What is inside |
| --- | --- |
| [replyze](https://github.com/Replyze/replyze) | Developer docs: the widget's JavaScript API, identity verification, REST API, webhooks |
| [add-live-chat-to-website](https://github.com/Replyze/add-live-chat-to-website) | Copy-paste code to add live chat to HTML, WordPress, Shopify, Wix, Webflow, Vue, Laravel and more |
| [react-live-chat](https://github.com/Replyze/react-live-chat) | The same chat as a React component, for Next.js and React apps |
| [react-native-live-chat](https://github.com/Replyze/react-native-live-chat) | Live chat and AI support in React Native and Expo apps |
| [flutter-live-chat](https://github.com/Replyze/flutter-live-chat) | Live chat and AI support in Flutter apps |
| [replyze-mcp](https://github.com/Replyze/replyze-mcp) | The Replyze MCP server for Claude, Cursor and VS Code |

## License

[MIT](LICENSE)

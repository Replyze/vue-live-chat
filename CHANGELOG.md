# Changelog

All notable changes to `@replyze/vue` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

The first version.

### Added

- `<ReplyzeChat>`: loads the Replyze widget (`https://cdn.replyze.chat/widget.js`) once per page, once mounted, with `lazyOnload` (default) or `afterInteractive`. Props for the token, language, visitor tracking, the look (`color`, `position`, `theme`, `botName`, `botAvatar`, `welcomeMessage`, `showGreetingTeaser`, `autoOpenDelay`), `apiUrl`, `scriptUrl` and a CSP `nonce`. The widget's events come out as Vue events (`@ready`, `@open`, `@close`, `@unread`, `@message:sent`, `@message:received`, `@identified`, `@reset`).
- The `user` prop: identifies a signed-in user once per page load, and calls `reset()` when they sign out or another user signs in.
- `Replyze`: the widget's methods for code anywhere, and a Vue plugin, `app.use(Replyze, { token })`. Calls made before the widget runs wait (up to 100) and run in order.
- `useReplyze()`: the methods plus `status`, `isOpen` and `unreadCount` as read-only refs, with no provide/inject. Server-rendered pages hydrate without a mismatch.
- `useReplyzeEvent()` and typed `on()` / `off()`.
- `createUserHash()` in `@replyze/vue/server`: the identity verification HMAC with Web Crypto (Node 20+, Nuxt server routes, Bun, Deno, Workers).
- ESM and CommonJS builds with types for both. Safe to import and render on the server (Nuxt 3 and 4). Vue 3.3 and newer.
- Examples: Nuxt (with a server route that signs the user) and Vite.

[0.1.0]: https://github.com/Replyze/vue-live-chat/releases/tag/v0.1.0

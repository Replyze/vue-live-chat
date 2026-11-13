# Nuxt example

A Nuxt 4 app with the Replyze chat: `<ReplyzeChat>` in `app/app.vue`, buttons that use `useReplyze()` and show the unread count, an event log with `useReplyzeEvent()`, and a demo sign-in whose user is signed with `user_hash` on the server when the identity secret is set.

```sh
# in the repository root first, once: builds the package
npm install

cd examples/nuxt
cp .env.example .env   # then set NUXT_PUBLIC_REPLYZE_TOKEN
npm install
npm run dev
```

Open http://localhost:3000. If the widget's **Allowed domains** list (Settings → Chat Widget) has entries, add `localhost` to it while you test.

| File | What it shows |
| --- | --- |
| `nuxt.config.ts` | The token in `runtimeConfig.public`, the identity secret in server-only `runtimeConfig` |
| `app/app.vue` | `<ReplyzeChat>` with the `user` prop, fetched from the server route |
| `app/components/ChatControls.vue` | `useReplyze()` and `useReplyzeEvent()` |
| `server/api/replyze-identity.get.ts` | `createUserHash()` from `@replyze/vue/server` |
| `server/api/demo-session.*.ts` | The demo sign-in and sign-out (a cookie) |

The example installs the package from `../..` as a packed copy (`.npmrc`: `install-links=true`), so after you change the package, run `npm install` here again. In your own app, install it with `npm install github:Replyze/vue-live-chat`.

The sign-in button sets a cookie and nothing else; the "user" it passes to the chat is made up, so use a test workspace.

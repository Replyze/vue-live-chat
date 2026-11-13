# Vite example

A Vue 3 app built with Vite, with the chat added by the plugin in `src/main.ts` (`app.use(Replyze, { token })`) and a button in `src/App.vue` that uses `useReplyze()`.

```sh
# in the repository root first, once: builds the package
npm install

cd examples/vite
cp .env.example .env.local   # then set VITE_REPLYZE_TOKEN
npm install
npm run dev
```

Open the URL Vite prints. If the widget's **Allowed domains** list (Settings → Chat Widget) has entries, add `localhost` to it while you test.

The example installs the package from `../..` as a packed copy (`.npmrc`: `install-links=true`). In your own app, install it with `npm install github:Replyze/vue-live-chat`.

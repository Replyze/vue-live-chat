export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  runtimeConfig: {
    // Server only, from NUXT_REPLYZE_IDENTITY_SECRET. Never put it under `public`.
    replyzeIdentitySecret: '',
    public: {
      // From NUXT_PUBLIC_REPLYZE_TOKEN: the widget token, wgt_...
      replyzeToken: '',
    },
  },
});

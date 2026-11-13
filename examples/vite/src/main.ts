import { createApp } from 'vue';
import { Replyze } from '@replyze/vue';
import App from './App.vue';

createApp(App)
  // The chat for the whole app: no <ReplyzeChat> needed in a template.
  .use(Replyze, { token: import.meta.env.VITE_REPLYZE_TOKEN })
  .mount('#app');

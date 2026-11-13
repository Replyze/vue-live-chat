// The built declaration files as an app sees them, with skipLibCheck off.
// CI compiles this against each Vue version it tests (npm run test:types).
import { createApp, h } from 'vue';
import { Replyze, ReplyzeChat, useReplyze, useReplyzeEvent, type ReplyzeIdentity } from '../../dist/index.js';
import { createUserHash } from '../../dist/server.js';

const user: ReplyzeIdentity = { user_id: 42, email: 'ana@shop.example', user_hash: 'abc' };
const app = createApp({
  render: () => h(ReplyzeChat, { token: 'wgt_x', botName: 'Ava', position: 'bottom_left', user, onUnread: (count: number) => count }),
});
app.use(Replyze, { token: 'wgt_x', strategy: 'afterInteractive' });
app.component('ReplyzeChat', ReplyzeChat);

const { isOpen, unreadCount, status, open } = useReplyze();
const flags: [boolean, number, string] = [isOpen.value, unreadCount.value, status.value];
open();
const stop: () => void = useReplyzeEvent('message:received', (message) => message.content.length);
Replyze.on('identified', ({ verified }) => verified);
const hash: Promise<string> = createUserHash('secret', { user_id: 42 });
void flags;
void stop;
void hash;

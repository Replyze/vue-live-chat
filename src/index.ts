// The browser entry: the component, the composables and the plugin. It is
// safe to import on the server (nothing runs until something is called in
// the browser). The identity secret belongs in @replyze/vue/server only.
export { ReplyzeChat } from './ReplyzeChat';
export { useReplyze, useReplyzeEvent } from './composables';
export type { UseReplyzeResult } from './composables';
export { Replyze } from './plugin';
export type { ReplyzePlugin } from './plugin';
export { DEFAULT_SCRIPT_URL } from './core';
export type {
  ReplyzeAttachment,
  ReplyzeChatProps,
  ReplyzeData,
  ReplyzeDataValue,
  ReplyzeEventHandler,
  ReplyzeEventMap,
  ReplyzeEventName,
  ReplyzeIdentity,
  ReplyzeLoadStrategy,
  ReplyzeMessage,
  ReplyzeMethods,
  ReplyzeOptions,
  ReplyzePosition,
  ReplyzeSentMessage,
  ReplyzeState,
  ReplyzeStatus,
  ReplyzeTheme,
  ReplyzeUser,
} from './types';

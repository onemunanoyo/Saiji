import type { Platform } from './types';

export const SELECTORS = {
  youtube: {
    iframeSelector: 'iframe#chatframe',
    chatContainer:  '#items',
    authorIdAttr:   'author-id',
    messageText:    '#message',
  },
  twitch: {
    iframeSelector: null as string | null,
    chatContainer:  '.chat-scrollable-area__message-container',
    authorIdAttr:   'data-user-id',
    messageText:    '.message',
  },
} as const;

export function detectPlatform(): Platform | null {
  const { hostname } = location;
  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('twitch.tv'))  return 'twitch';
  return null;
}

/** チャット欄が属する document を取得（YouTube は iframe 内） */
export function getChatDocument(platform: Platform): Document | null {
  const iframeSel = SELECTORS[platform].iframeSelector;
  if (!iframeSel) return document;

  const iframe = document.querySelector(iframeSel) as HTMLIFrameElement | null;
  return iframe?.contentDocument ?? null;
}

/** チャット欄コンテナを取得 */
export function getChatContainer(platform: Platform): Element | null {
  const doc = getChatDocument(platform);
  return doc?.querySelector(SELECTORS[platform].chatContainer) ?? null;
}

/** コメント要素から author-id を取得 */
export function getAuthorId(el: Element, platform: Platform): string | null {
  return el.getAttribute(SELECTORS[platform].authorIdAttr) ?? null;
}

/** コメント要素からテキストを取得 */
export function getMessageText(el: Element, platform: Platform): string {
  return el.querySelector(SELECTORS[platform].messageText)?.textContent?.trim() ?? '';
}
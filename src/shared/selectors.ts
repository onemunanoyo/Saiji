import type { Platform, WatchMode } from './types';

export const SELECTORS = {
  youtube: {
    iframeSelector: 'iframe#chatframe',
    chatContainer:  '#items',
    authorName:     '#author-name',
    messageText:    '#message',
  },
  twitch: {
    iframeSelector: null as string | null,
    chatContainer:  '.chat-scrollable-area__message-container',
    authorName:     '[data-a-user]',
    messageText:    '.chat-line__message',
  },
} as const;

export function detectPlatform(): Platform | null {
  const { hostname } = location;
  if (hostname.includes('youtube.com')) return 'youtube';
  if (hostname.includes('twitch.tv'))  return 'twitch';
  return null;
}

/** ライブ配信かアーカイブかを判定 */
export function detectWatchMode(): WatchMode {
  // YouTube: ytd-watch-flexy の is-live 属性で判定
  const isLive = document.querySelector('ytd-watch-flexy')?.getAttribute('is-live');
  if (isLive !== null && isLive !== undefined) return 'live';
  // Twitch は常にライブ
  if (location.hostname.includes('twitch.tv')) return 'live';
  return 'archive';
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

/** コメント要素からユーザー識別子を取得 */
export function getAuthorId(el: Element, platform: Platform): string | null {
  const sel = SELECTORS[platform].authorName;
  const authorEl = el.querySelector(sel);
  if (!authorEl) return null;
  if (platform === 'twitch') {
    return authorEl.getAttribute('data-a-user') ?? null;
  }
  return authorEl.textContent?.trim() ?? null;
}

/** コメント要素からテキストを取得 */
export function getMessageText(el: Element, platform: Platform): string {
  return el.querySelector(SELECTORS[platform].messageText)?.textContent?.trim() ?? '';
}
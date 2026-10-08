import type { Platform, WatchMode } from './types';

export const SELECTORS = {
  youtube: {
    iframeSelector: 'iframe#chatframe',
    chatContainer:  '#items',
    authorName:     '#author-name',
    messageText:    '#message',
    // 通常動画コメント用
    normalCommentContainer: '#comments #sections #contents',
    normalCommentThread:    'ytd-comment-thread-renderer',
    normalComment:          'ytd-comment-renderer',
    normalAuthorName:       'a#author-text',
    normalMessageText:      '#content-text',
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

/** ライブ配信かアーカイブか通常動画かを判定 */
export function detectWatchMode(): WatchMode {
  // YouTube: ytd-watch-flexy の is-live 属性で判定
  const watchFlexy = document.querySelector('ytd-watch-flexy');
  if (watchFlexy) {
    const isLive = watchFlexy.getAttribute('is-live');
    if (isLive !== null && isLive !== undefined) return 'live';
    const chatFrame = document.querySelector('iframe#chatframe');
    if (chatFrame) return 'archive';
    return 'normal';
  }
  // Twitch は常にライブ
  if (location.hostname.includes('twitch.tv')) return 'live';
  return 'normal';
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
  if (platform === 'youtube') {
    const isNormal = el.tagName.toLowerCase() === 'ytd-comment-renderer' || el.tagName.toLowerCase() === 'ytd-comment-thread-renderer' || el.querySelector('a#author-text');
    if (isNormal) {
      const authorEl = el.querySelector('a#author-text');
      if (!authorEl) return null;
      const href = authorEl.getAttribute('href');
      if (href) {
        const parts = href.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart) return lastPart;
      }
      return authorEl.textContent?.trim() ?? null;
    }
  }

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
  if (platform === 'youtube') {
    const isNormal = el.tagName.toLowerCase() === 'ytd-comment-renderer' || el.tagName.toLowerCase() === 'ytd-comment-thread-renderer' || el.querySelector('#content-text');
    if (isNormal) {
      return el.querySelector('#content-text')?.textContent?.trim() ?? '';
    }
  }
  return el.querySelector(SELECTORS[platform].messageText)?.textContent?.trim() ?? '';
}

/** 通常動画コメント欄コンテナを取得 */
export function getNormalCommentContainer(): Element | null {
  return document.querySelector('#comments #sections #contents') ?? document.querySelector('ytd-comments');
}
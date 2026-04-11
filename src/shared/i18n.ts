export const t = (key: string, ...subs: string[]): string =>
  chrome.i18n.getMessage(key, subs.length ? subs : undefined);

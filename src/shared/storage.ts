import type { StorageSchema, StorageKey, NgWord } from './types';
import { cleanToxicSettings, DEFAULT_TOXIC_SETTINGS } from './toxic';

export const DEFAULT_STORAGE: StorageSchema = {
  ngWords:            [],
  bannedIds:          [],
  filterEnabled:      true,
  blUpdatedAt:        Date.now(),
  sessionFiltered:    0,
  commentLockEnabled: false,
  toxicSettings: structuredClone(DEFAULT_TOXIC_SETTINGS),
};

function cleanNgWords(words: any[]): NgWord[] {
  if (!Array.isArray(words)) return [];
  return words.map(w => {
    if (w && (w.platform === 'youtube' as any)) {
      return { ...w, platform: 'youtube_live' };
    }
    return w as NgWord;
  });
}

export async function getStorage<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  let val = result[key] ?? DEFAULT_STORAGE[key];
  if (key === 'ngWords') {
    val = cleanNgWords(val);
  }
  if (key === 'toxicSettings') val = cleanToxicSettings(val);
  return val as StorageSchema[K];
}

export async function setStorage<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getStorageAll(): Promise<StorageSchema> {
  const result = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_STORAGE, ...result } as StorageSchema;
  merged.ngWords = cleanNgWords(merged.ngWords);
  merged.toxicSettings = cleanToxicSettings(merged.toxicSettings);
  return merged;
}

export async function addBannedId(authorId: string): Promise<void> {
  const current = await getStorage('bannedIds');
  if (!authorId || current.includes(authorId)) return;
  await setStorage('bannedIds', [...current, authorId]);
}

export async function removeBannedId(authorId: string): Promise<void> {
  const current = await getStorage('bannedIds');
  await setStorage('bannedIds', current.filter(id => id !== authorId));
}

export async function clearBlacklist(): Promise<void> {
  await setStorage('bannedIds', []);
  await setStorage('blUpdatedAt', Date.now());
}

function normalizeWord(str: string): string {
  return str
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .toLowerCase();
}

export async function addNgWord(word: NgWord): Promise<void> {
  const current = await getStorage('ngWords');
  if (!word.word.trim()) return;
  // 正規化した上で重複チェック（w・ｗ・Wは同一扱い）
  if (current.some(w => normalizeWord(w.word) === normalizeWord(word.word) && w.platform === word.platform)) return;
  await setStorage('ngWords', [...current, word]);
}

export async function removeNgWord(word: string, platform: NgWord['platform']): Promise<void> {
  const current = await getStorage('ngWords');
  await setStorage('ngWords', current.filter(w => !(w.word === word && w.platform === platform)));
}

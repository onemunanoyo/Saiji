import type { StorageSchema, StorageKey, NgWord } from './types';

export const DEFAULT_STORAGE: StorageSchema = {
  ngWords:         [],
  bannedIds:       [],
  filterEnabled:   true,
  blUpdatedAt:     Date.now(),
  sessionFiltered: 0,
};

export async function getStorage<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? DEFAULT_STORAGE[key]) as StorageSchema[K];
}

export async function setStorage<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getStorageAll(): Promise<StorageSchema> {
  const result = await chrome.storage.local.get(null);
  return { ...DEFAULT_STORAGE, ...result } as StorageSchema;
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

export async function addNgWord(word: NgWord): Promise<void> {
  const current = await getStorage('ngWords');
  if (!word.word.trim()) return;
  // 同じワード・同じplatformの重複を排除
  if (current.some(w => w.word === word.word && w.platform === word.platform)) return;
  await setStorage('ngWords', [...current, word]);
}

export async function removeNgWord(word: string, platform: NgWord['platform']): Promise<void> {
  const current = await getStorage('ngWords');
  await setStorage('ngWords', current.filter(w => !(w.word === word && w.platform === platform)));
}
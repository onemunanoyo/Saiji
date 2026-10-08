export const TOXIC_LABELS = [
  'toxicity', 'harassment', 'obscene', 'discrimination', 'threat',
  'spoiler', 'instruction', 'pigeon', 'self_promotion', 'spam',
] as const;

export type ToxicLabel = typeof TOXIC_LABELS[number];
export type ToxicScores = Record<ToxicLabel, number>;
export interface ToxicSettings {
  enabled: boolean;
  downloadMissingModel?: boolean;
  backend?: 'auto' | 'webgpu' | 'wasm';
  thresholds: Partial<Record<ToxicLabel, number>>;
}
export type ToxicResponse = { ok: true; scores: ToxicScores } | { ok: false; error: string };

export const README_THRESHOLDS: ToxicSettings['thresholds'] = { harassment: 0.6, obscene: 0.6, discrimination: 0.6, threat: 0.6, spoiler: 0.7, self_promotion: 0.7, spam: 0.7 };

export const DEFAULT_TOXIC_SETTINGS: ToxicSettings = {
  enabled: false,
  downloadMissingModel: true,
  thresholds: Object.fromEntries(TOXIC_LABELS.slice(0, 5).map(label => [label, 0.005039215087890625])),
};

export function cleanToxicSettings(value: unknown): ToxicSettings {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_TOXIC_SETTINGS);
  const raw = value as Partial<ToxicSettings>;
  const thresholds: ToxicSettings['thresholds'] = {};
  if (raw.thresholds && typeof raw.thresholds === 'object') {
    for (const label of TOXIC_LABELS) {
      const threshold = raw.thresholds[label];
      if (typeof threshold === 'number' && Number.isFinite(threshold) && threshold > 0 && threshold <= 1) {
        thresholds[label] = threshold;
      }
    }
  }
  const backend = raw.backend === 'webgpu' || raw.backend === 'wasm' ? raw.backend : 'auto';
  return { enabled: raw.enabled === true, thresholds, backend, downloadMissingModel: raw.downloadMissingModel !== false };
}

export function parseScores(value: unknown): ToxicScores | null {
  if (!value || typeof value !== 'object') return null;
  const scores = value as ToxicScores;
  return TOXIC_LABELS.every(label => typeof scores[label] === 'number' &&
      Number.isFinite(scores[label]) && scores[label] >= 0 && scores[label] <= 1) ? scores : null;
}

export function matchingLabels(scores: ToxicScores, settings: ToxicSettings): ToxicLabel[] {
  if (!settings.enabled) return [];
  return TOXIC_LABELS.filter(label => {
    const threshold = settings.thresholds[label];
    return threshold !== undefined && scores[label] >= threshold;
  });
}

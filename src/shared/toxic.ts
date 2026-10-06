export const TOXIC_LABELS = [
  'toxicity', 'harassment', 'obscene', 'discrimination', 'threat',
  'spoiler', 'instruction', 'pigeon', 'self_promotion', 'spam',
] as const;

export type ToxicLabel = typeof TOXIC_LABELS[number];
export type ToxicScores = Record<ToxicLabel, number>;
export interface ToxicSettings {
  enabled: boolean;
  thresholds: Partial<Record<ToxicLabel, number>>;
}
export type ToxicResponse = { ok: true; scores: ToxicScores } | { ok: false; error: string };

export const TOXIC_ORIGIN = 'http://127.0.0.1:8765';
export const TOXIC_PERMISSION = 'http://127.0.0.1/*';
export const DEFAULT_TOXIC_SETTINGS: ToxicSettings = {
  enabled: false,
  thresholds: { harassment: 0.6, obscene: 0.6, threat: 0.6, spoiler: 0.7, self_promotion: 0.7, spam: 0.7 },
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
  return { enabled: raw.enabled === true, thresholds };
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

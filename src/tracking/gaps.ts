import type { TrackPoint } from './types';

export type Gap = { fromMs: number; toMs: number; seconds: number };

export type GapReport = {
  pointCount: number;
  durationSec: number;
  medianIntervalSec: number;
  /** Intervallo più lungo tra due punti consecutivi, contando solo quelli che partono in movimento. */
  maxGapSec: number;
  gaps: Gap[];
};

export type GapOptions = { maxGapSec: number; movingSpeedMs: number };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function analyzeGaps(points: TrackPoint[], opts: GapOptions): GapReport {
  const sorted = [...points].sort((a, b) => a.recordedAt - b.recordedAt);
  const intervals: number[] = [];
  const gaps: Gap[] = [];
  let maxGapSec = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const seconds = (cur.recordedAt - prev.recordedAt) / 1000;
    intervals.push(seconds);
    const moving = prev.speed === null || prev.speed >= opts.movingSpeedMs;
    if (!moving) continue;
    if (seconds > maxGapSec) maxGapSec = seconds;
    if (seconds > opts.maxGapSec) {
      gaps.push({ fromMs: prev.recordedAt, toMs: cur.recordedAt, seconds });
    }
  }

  const durationSec =
    sorted.length > 1 ? (sorted[sorted.length - 1].recordedAt - sorted[0].recordedAt) / 1000 : 0;

  return {
    pointCount: sorted.length,
    durationSec,
    medianIntervalSec: median(intervals),
    maxGapSec,
    gaps,
  };
}

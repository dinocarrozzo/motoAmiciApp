import { analyzeGaps } from './gaps';
import type { TrackPoint } from './types';

const opts = { maxGapSec: 30, movingSpeedMs: 1 };
const pt = (sec: number, speed: number | null = 10): TrackPoint => ({
  sessionId: 's',
  recordedAt: sec * 1000,
  lat: 44,
  lng: 11,
  accuracy: 5,
  speed,
});

test('punti ogni 5 s → nessun buco', () => {
  const points = [0, 5, 10, 15, 20].map((s) => pt(s));
  const r = analyzeGaps(points, opts);
  expect(r.gaps).toEqual([]);
  expect(r.medianIntervalSec).toBe(5);
  expect(r.pointCount).toBe(5);
  expect(r.durationSec).toBe(20);
});

test('buco di 60 s con maxGapSec 30 → un buco di 60 s', () => {
  const r = analyzeGaps([pt(0), pt(5), pt(65), pt(70)], opts);
  expect(r.gaps).toEqual([{ fromMs: 5000, toMs: 65000, seconds: 60 }]);
  expect(r.maxGapSec).toBe(60);
});

test('buco di 60 s da fermo (speed 0) → non conta', () => {
  const r = analyzeGaps([pt(0), pt(5, 0), pt(65), pt(70)], opts);
  expect(r.gaps).toEqual([]);
  expect(r.maxGapSec).toBe(5); // solo 0→5 parte in movimento
});

test('speed nulla conta come in movimento', () => {
  const r = analyzeGaps([pt(0, null), pt(60)], opts);
  expect(r.gaps).toHaveLength(1);
});

test('punti fuori ordine → stesso risultato dei punti ordinati', () => {
  const ordered = [pt(0), pt(5), pt(65), pt(70)];
  const shuffled = [pt(65), pt(0), pt(70), pt(5)];
  expect(analyzeGaps(shuffled, opts)).toEqual(analyzeGaps(ordered, opts));
});

test('lista vuota → tutto a zero, nessun NaN', () => {
  expect(analyzeGaps([], opts)).toEqual({
    pointCount: 0,
    durationSec: 0,
    medianIntervalSec: 0,
    maxGapSec: 0,
    gaps: [],
  });
});

test('un solo punto → tutto a zero tranne pointCount, nessun NaN', () => {
  expect(analyzeGaps([pt(0)], opts)).toEqual({
    pointCount: 1,
    durationSec: 0,
    medianIntervalSec: 0,
    maxGapSec: 0,
    gaps: [],
  });
});

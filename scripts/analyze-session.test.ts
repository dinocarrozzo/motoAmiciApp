import { formatReport } from './report';
import type { GapReport } from '../src/tracking/gaps';

const report: GapReport = {
  pointCount: 120,
  durationSec: 7200,
  medianIntervalSec: 6,
  maxGapSec: 75,
  gaps: [{ fromMs: Date.UTC(2026, 10, 22, 10, 0, 0), toMs: Date.UTC(2026, 10, 22, 10, 1, 15), seconds: 75 }],
};

test('il referto riporta punti, buco massimo e numero di buchi', () => {
  const text = formatReport(report, 90, 74, 2);
  expect(text).toContain('Punti totali: 120');
  expect(text).toContain('Buco massimo: 75 s');
  expect(text).toContain('Buchi oltre soglia: 1');
});

test('consumo di batteria in %/h con la virgola: 16 punti in 2 h → 8,0 %/h', () => {
  expect(formatReport(report, 90, 74, 2)).toContain('8,0 %/h');
});

test('con hours 0 non divide per zero', () => {
  const text = formatReport(report, 90, 74, 0);
  expect(text).toContain('n.d.');
  expect(text).not.toMatch(/Infinity|NaN/);
});

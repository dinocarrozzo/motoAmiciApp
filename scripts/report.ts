import type { GapReport } from '../src/tracking/gaps';

export function formatReport(
  report: GapReport,
  batteryStartPct: number,
  batteryEndPct: number,
  hours: number,
): string {
  const perHour = hours > 0 ? ((batteryStartPct - batteryEndPct) / hours).toFixed(1).replace('.', ',') + ' %/h' : 'n.d.';
  const lines = [
    `Punti totali: ${report.pointCount}`,
    `Durata: ${Math.round(report.durationSec / 60)} min`,
    `Intervallo mediano: ${report.medianIntervalSec} s`,
    `Buco massimo: ${report.maxGapSec} s`,
    `Buchi oltre soglia: ${report.gaps.length}`,
    ...report.gaps.map(
      (g) => `  - ${new Date(g.fromMs).toISOString()} → ${new Date(g.toMs).toISOString()} (${g.seconds} s)`,
    ),
    `Consumo batteria: ${perHour}`,
  ];
  return lines.join('\n');
}

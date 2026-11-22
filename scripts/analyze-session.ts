// Uso: npx tsx scripts/analyze-session.ts <sessionId> --battery-start 90 --battery-end 74 --hours 2
// Richiede SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nell'ambiente (mai nel repository).
import { createClient } from '@supabase/supabase-js';
import { analyzeGaps } from '../src/tracking/gaps';
import type { TrackPoint } from '../src/tracking/types';
import { formatReport } from './report';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

async function main() {
  const sessionId = process.argv[2];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionId || !url || !key) {
    console.error('Uso: analyze-session.ts <sessionId> [--battery-start N --battery-end N --hours N] (con SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  const client = createClient(url, key);
  const points: TrackPoint[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('track_points')
      .select('session_id,recorded_at,lat,lng,accuracy,speed')
      .eq('session_id', sessionId)
      .order('recorded_at')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    points.push(
      ...data.map((r: any) => ({
        sessionId: r.session_id,
        recordedAt: Date.parse(r.recorded_at),
        lat: r.lat,
        lng: r.lng,
        accuracy: r.accuracy,
        speed: r.speed,
      })),
    );
    if (data.length < 1000) break;
  }
  const report = analyzeGaps(points, { maxGapSec: 120, movingSpeedMs: 1 });
  console.log(formatReport(report, arg('battery-start', NaN), arg('battery-end', NaN), arg('hours', 0)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

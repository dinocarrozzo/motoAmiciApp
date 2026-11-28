import type { BBox } from './types';

/** `b` = [ovest, sud, est, nord], come restituisce la libreria della mappa. */
export function bboxFromBounds(b: [number, number, number, number]): BBox {
  const [west, south, east, north] = b;
  return { minLat: south, minLng: west, maxLat: north, maxLng: east };
}

export function clampBox(b: BBox, maxSpan = 1): BBox {
  const shrink = (min: number, max: number): [number, number] => {
    if (max - min <= maxSpan) return [min, max];
    const c = (min + max) / 2;
    return [c - maxSpan / 2, c + maxSpan / 2];
  };
  const [minLat, maxLat] = shrink(b.minLat, b.maxLat);
  const [minLng, maxLng] = shrink(b.minLng, b.maxLng);
  return { minLat, minLng, maxLat, maxLng };
}

export function movedEnough(prev: BBox | null, next: BBox): boolean {
  if (!prev) return true;
  const pw = prev.maxLng - prev.minLng;
  const ph = prev.maxLat - prev.minLat;
  const nw = next.maxLng - next.minLng;
  const nh = next.maxLat - next.minLat;
  const dx = Math.abs((next.minLng + next.maxLng) / 2 - (prev.minLng + prev.maxLng) / 2);
  const dy = Math.abs((next.minLat + next.maxLat) / 2 - (prev.minLat + prev.maxLat) / 2);
  if (dx > 0.25 * pw || dy > 0.25 * ph) return true;
  if (pw === 0 || ph === 0) return true;
  return Math.abs(nw - pw) / pw > 0.3 || Math.abs(nh - ph) / ph > 0.3;
}

export const bboxCenter = (b: BBox): { lat: number; lng: number } => ({
  lat: (b.minLat + b.maxLat) / 2,
  lng: (b.minLng + b.maxLng) / 2,
});

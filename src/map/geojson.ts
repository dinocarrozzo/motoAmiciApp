import { markerColor } from './riderCard';
import type { Rider } from './types';

export const FRIEND_RING_COLOR = '#facc15';
export const NORMAL_RING_COLOR = '#ffffff';

/** I motociclisti come punti per la mappa: colore dal sesso, anello giallo per gli amici. */
export function ridersToGeoJSON(riders: Rider[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: riders.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { id: r.id, color: markerColor(r.gender), ring: r.isFriend ? FRIEND_RING_COLOR : NORMAL_RING_COLOR },
    })),
  };
}

/** Evita di ridisegnare la mappa quando l'elenco non è cambiato. */
export const sameRiders = (a: Rider[], b: Rider[]): boolean => JSON.stringify(a) === JSON.stringify(b);

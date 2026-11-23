/** Stato dei permessi nei codici usati dal tracker (3 = sempre, 4 = solo in uso, 2 = negato). */
export function statusFromPermissions(foregroundGranted: boolean, backgroundGranted: boolean): number {
  if (!foregroundGranted) return 2;
  return backgroundGranted ? 3 : 4;
}

type ExpoLocation = {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null };
};

/** Porta una posizione di expo-location nel formato che il tracker già conosce. */
export function toLibLocation(l: ExpoLocation) {
  return {
    timestamp: l.timestamp,
    coords: {
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      accuracy: l.coords.accuracy,
      speed: l.coords.speed,
    },
  };
}

/**
 * Profilo di tracciamento del motore gratuito. Scelto per ridurre la batteria:
 * precisione alta (non "navigazione"), un punto ogni 10 secondi, filtro di 10 metri.
 */
export const TRACKING_PROFILE = {
  accuracy: 'High' as 'High',
  timeIntervalMs: 10_000,
  distanceIntervalM: 10,
};

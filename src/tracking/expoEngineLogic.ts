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

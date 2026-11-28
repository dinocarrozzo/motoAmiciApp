const DAY = 24 * 3_600_000;

/** Punto d'incontro e nota si mostrano per 24 ore dalla risposta. */
export const isMeetPointFresh = (answeredAt: number | null, now: number): boolean =>
  answeredAt !== null && now - answeredAt <= DAY;

/** Apre Google Maps (o l'app di mappe del telefono) con le indicazioni per raggiungere il punto. */
export const mapsDirectionsUrl = (p: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

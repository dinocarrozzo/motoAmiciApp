const DAY = 24 * 3_600_000;

/** Punto d'incontro e nota si mostrano per 24 ore dalla risposta. */
export const isMeetPointFresh = (answeredAt: number | null, now: number): boolean =>
  answeredAt !== null && now - answeredAt <= DAY;

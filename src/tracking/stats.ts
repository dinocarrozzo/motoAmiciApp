/** Contatori mostrati sullo schermo per il giro in corso. Vivono in memoria. */
export const stats = { sent: 0, lastSentAt: null as number | null, lastError: null as string | null };

export function recordSent(count: number, at: number = Date.now()): void {
  stats.sent += count;
  stats.lastSentAt = at;
  stats.lastError = null;
}

export function recordError(message: string): void {
  stats.lastError = message;
}

/** Da chiamare a ogni nuovo avvio: ogni giro riparte da zero. */
export function resetStats(): void {
  stats.sent = 0;
  stats.lastSentAt = null;
  stats.lastError = null;
}

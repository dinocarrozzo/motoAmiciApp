/**
 * Avvolge fetch con un tempo massimo: una richiesta che non risponde mai
 * (rete bloccata o instabile) viene annullata invece di restare appesa per sempre.
 */
export function fetchWithTimeout(ms: number, base: typeof fetch = fetch): typeof fetch {
  return ((input: any, init: any = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    // Se chi chiama ha già un proprio segnale di annullamento, lo rispettiamo.
    init.signal?.addEventListener?.('abort', () => controller.abort());
    return base(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  }) as typeof fetch;
}

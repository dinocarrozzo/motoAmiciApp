type Deps = { refresh: () => Promise<void>; intervalMs: number };

/**
 * Aggiorna periodicamente finché è «attivo» (scheda visibile e app aperta): subito all'attivazione,
 * poi a ogni intervallo. Non sovrappone due aggiornamenti e un errore di rete non lo ferma.
 */
export function createRefreshLoop({ refresh, intervalMs }: Deps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let disposed = false;

  const run = async () => {
    if (inFlight || disposed) return;
    inFlight = true;
    try {
      await refresh();
    } catch {
      // al prossimo giro si riprova
    } finally {
      inFlight = false;
    }
  };

  return {
    setActive(active: boolean): void {
      if (disposed) return;
      if (active && !timer) {
        void run();
        timer = setInterval(() => void run(), intervalMs);
      } else if (!active && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    dispose(): void {
      disposed = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

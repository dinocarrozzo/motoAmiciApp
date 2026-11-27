import { movedEnough } from './bbox';
import type { BBox, Rider } from './types';

/**
 * Chiede al server i motociclisti della zona visibile. Richiede solo se la zona è cambiata abbastanza
 * (o su refresh esplicito), ignora le risposte superate e, dopo un errore, lascia l'ultimo elenco buono.
 */
export function createRidersFeed(deps: {
  fetch: (box: BBox) => Promise<Rider[]>;
  onRiders: (r: Rider[]) => void;
  onError: (message: string) => void;
}) {
  let current: BBox | null = null;
  let lastRequested: BBox | null = null;
  let seq = 0;
  let disposed = false;

  async function request(box: BBox): Promise<void> {
    lastRequested = box;
    const mine = ++seq;
    try {
      const riders = await deps.fetch(box);
      if (!disposed && mine === seq) deps.onRiders(riders);
    } catch (e) {
      if (!disposed && mine === seq) deps.onError(e instanceof Error ? e.message : 'Errore di rete');
    }
  }

  return {
    setBox(b: BBox): void {
      if (disposed) return;
      current = b;
      if (movedEnough(lastRequested, b)) void request(b);
    },
    async refresh(): Promise<void> {
      if (disposed || !current) return;
      await request(current);
    },
    dispose(): void {
      disposed = true;
    },
  };
}

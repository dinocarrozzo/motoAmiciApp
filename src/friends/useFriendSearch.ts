import type { ProfileSummary } from '../profile/types';
import { normalizeQuery } from './search';

type Deps = {
  search: (q: string) => Promise<ProfileSummary[]>;
  onResults: (r: ProfileSummary[]) => void;
  onError: (message: string) => void;
  delayMs?: number;
};

/**
 * Ricerca con suggerimenti mentre si scrive: aspetta un attimo dall'ultima lettera, non cerca sotto i 2 caratteri
 * e ignora le risposte di ricerche superate da una più recente.
 */
export function createFriendSearch(deps: Deps) {
  const delay = deps.delayMs ?? 300;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let disposed = false;

  const cancelTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    type(q: string): void {
      if (disposed) return;
      cancelTimer();
      const query = normalizeQuery(q);
      seq += 1; // ogni nuova digitazione rende superata la ricerca in corso
      if (query === null) {
        deps.onResults([]);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        const mine = ++seq;
        deps.search(query).then(
          (res) => {
            if (!disposed && mine === seq) deps.onResults(res);
          },
          (e) => {
            if (disposed || mine !== seq) return;
            deps.onResults([]);
            deps.onError(e instanceof Error ? e.message : String(e));
          },
        );
      }, delay);
    },
    dispose(): void {
      disposed = true;
      cancelTimer();
    },
  };
}

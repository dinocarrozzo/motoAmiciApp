/** Testo di ricerca pulito, oppure null se è troppo corto per cercare (meno di 2 caratteri). */
export function normalizeQuery(q: string): string | null {
  const v = q.replace(/[%_\\]/g, '').replace(/\s+/g, ' ').trim();
  return v.length >= 2 ? v : null;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...a: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...a);
    }, ms);
  };
}

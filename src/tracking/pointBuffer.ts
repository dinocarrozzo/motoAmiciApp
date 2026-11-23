import type { TrackPoint } from './types';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type Deps = {
  store: KeyValueStore;
  send: (points: TrackPoint[]) => Promise<void>;
  batchSize?: number;
  storageKey?: string;
  /** Tempo massimo di un invio; oltre, i punti restano in coda e si riprova. Default 20 s. */
  sendTimeoutMs?: number;
};

/**
 * Coda persistente dei punti GPS. Le operazioni sulla coda sono brevi e vengono eseguite
 * una alla volta. L'invio in rete NON tiene occupata la coda: un invio lento o appeso
 * non blocca l'aggiunta di nuovi punti né il conteggio.
 */
export class PointBuffer {
  private readonly store: KeyValueStore;
  private readonly send: (points: TrackPoint[]) => Promise<void>;
  private readonly batchSize: number;
  private readonly storageKey: string;
  private readonly sendTimeoutMs: number;
  private flushing: Promise<{ sent: number; pending: number }> | null = null;
  private queue: TrackPoint[] | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(deps: Deps) {
    this.store = deps.store;
    this.send = deps.send;
    this.batchSize = deps.batchSize ?? 20;
    this.storageKey = deps.storageKey ?? 'motoamici.pointBuffer';
    this.sendTimeoutMs = deps.sendTimeoutMs ?? 20_000;
  }

  add(point: TrackPoint): Promise<void> {
    return this.run(async () => {
      const q = await this.load();
      q.push(point);
      await this.persist(q);
    });
  }

  /** Invia i punti in coda. Chiamate contemporanee condividono lo stesso invio. Non lancia mai. */
  flush(): Promise<{ sent: number; pending: number }> {
    if (this.flushing) return this.flushing;
    const p = this.doFlush().finally(() => {
      this.flushing = null;
    });
    this.flushing = p;
    return p;
  }

  private async doFlush(): Promise<{ sent: number; pending: number }> {
    let sent = 0;
    for (;;) {
      const batch = await this.run(async () => (await this.load()).slice(0, this.batchSize));
      if (batch.length === 0) break;
      try {
        await this.sendWithTimeout(batch);
      } catch {
        break; // i punti restano in coda: si riprova al prossimo flush
      }
      await this.run(async () => {
        const q = await this.load();
        q.splice(0, batch.length);
        await this.persist(q);
      });
      sent += batch.length;
    }
    const pending = await this.run(async () => (await this.load()).length);
    return { sent, pending };
  }

  private sendWithTimeout(batch: TrackPoint[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout invio')), this.sendTimeoutMs);
      this.send(batch).then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  pendingCount(): Promise<number> {
    return this.run(async () => (await this.load()).length);
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task);
    this.chain = result.catch(() => undefined);
    return result;
  }

  private async load(): Promise<TrackPoint[]> {
    if (this.queue) return this.queue;
    const raw = await this.store.getItem(this.storageKey);
    this.queue = raw ? (JSON.parse(raw) as TrackPoint[]) : [];
    return this.queue;
  }

  private persist(q: TrackPoint[]): Promise<void> {
    return this.store.setItem(this.storageKey, JSON.stringify(q));
  }
}

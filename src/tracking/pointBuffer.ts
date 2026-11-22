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
};

/**
 * Coda persistente dei punti GPS. Le operazioni vengono eseguite una alla volta,
 * così un `add` durante un invio in corso non perde punti.
 */
export class PointBuffer {
  private readonly store: KeyValueStore;
  private readonly send: (points: TrackPoint[]) => Promise<void>;
  private readonly batchSize: number;
  private readonly storageKey: string;
  private queue: TrackPoint[] | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(deps: Deps) {
    this.store = deps.store;
    this.send = deps.send;
    this.batchSize = deps.batchSize ?? 20;
    this.storageKey = deps.storageKey ?? 'motoamici.pointBuffer';
  }

  add(point: TrackPoint): Promise<void> {
    return this.run(async () => {
      const q = await this.load();
      q.push(point);
      await this.persist(q);
    });
  }

  flush(): Promise<{ sent: number; pending: number }> {
    return this.run(async () => {
      const q = await this.load();
      let sent = 0;
      while (q.length > 0) {
        const batch = q.slice(0, this.batchSize);
        try {
          await this.send(batch);
        } catch {
          break;
        }
        q.splice(0, batch.length);
        sent += batch.length;
        await this.persist(q);
      }
      return { sent, pending: q.length };
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

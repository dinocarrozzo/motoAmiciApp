import { KeyValueStore, PointBuffer } from './pointBuffer';
import type { TrackPoint } from './types';

const pt = (n: number): TrackPoint => ({
  sessionId: 's',
  recordedAt: n * 1000,
  lat: 44,
  lng: 11,
  accuracy: 5,
  speed: 10,
});

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
}

test('add salva nello store: una nuova istanza vede il punto pendente', async () => {
  const store = memoryStore();
  const a = new PointBuffer({ store, send: async () => {} });
  await a.add(pt(1));
  const b = new PointBuffer({ store, send: async () => {} });
  expect(await b.pendingCount()).toBe(1);
});

test('flush invia in ordine e a lotti', async () => {
  const batches: TrackPoint[][] = [];
  const buf = new PointBuffer({
    store: memoryStore(),
    batchSize: 20,
    send: async (pts) => {
      batches.push(pts);
    },
  });
  for (let i = 0; i < 45; i++) await buf.add(pt(i));
  const res = await buf.flush();
  expect(res).toEqual({ sent: 45, pending: 0 });
  expect(batches.map((b) => b.length)).toEqual([20, 20, 5]);
  expect(batches.flat().map((p) => p.recordedAt)).toEqual(
    Array.from({ length: 45 }, (_, i) => i * 1000),
  );
});

test('flush con send che fallisce non lancia e mantiene i punti', async () => {
  const buf = new PointBuffer({
    store: memoryStore(),
    send: async () => {
      throw new Error('niente rete');
    },
  });
  for (let i = 0; i < 45; i++) await buf.add(pt(i));
  await expect(buf.flush()).resolves.toEqual({ sent: 0, pending: 45 });
});

test('dopo un errore il flush successivo invia ogni punto una sola volta', async () => {
  let fail = true;
  const received: number[] = [];
  const buf = new PointBuffer({
    store: memoryStore(),
    send: async (pts) => {
      if (fail) throw new Error('niente rete');
      received.push(...pts.map((p) => p.recordedAt));
    },
  });
  for (let i = 0; i < 25; i++) await buf.add(pt(i));
  await buf.flush();
  fail = false;
  const res = await buf.flush();
  expect(res).toEqual({ sent: 25, pending: 0 });
  expect(received).toEqual(Array.from({ length: 25 }, (_, i) => i * 1000));
});

test('una nuova istanza recupera i punti pendenti dopo il riavvio e li invia', async () => {
  const store = memoryStore();
  const first = new PointBuffer({
    store,
    send: async () => {
      throw new Error('niente rete');
    },
  });
  await first.add(pt(1));
  await first.add(pt(2));
  await first.flush();

  const sent: TrackPoint[] = [];
  const second = new PointBuffer({
    store,
    send: async (pts) => {
      sent.push(...pts);
    },
  });
  expect(await second.flush()).toEqual({ sent: 2, pending: 0 });
  expect(sent.map((p) => p.recordedAt)).toEqual([1000, 2000]);
});

test('un punto aggiunto durante un invio in corso non va perso', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const received: number[] = [];
  const buf = new PointBuffer({
    store: memoryStore(),
    send: async (pts) => {
      await gate;
      received.push(...pts.map((p) => p.recordedAt));
    },
  });
  await buf.add(pt(1));
  const flushing = buf.flush();
  const adding = buf.add(pt(2));
  release();
  await Promise.all([flushing, adding]);
  await buf.flush();
  expect(received).toEqual([1000, 2000]);
  expect(await buf.pendingCount()).toBe(0);
});

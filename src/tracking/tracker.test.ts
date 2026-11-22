import { createTracker, type GeoLib } from './tracker';
import { KeyValueStore, PointBuffer } from './pointBuffer';
import type { TrackPoint } from './types';

const DENIED = 2;
const ALWAYS = 3;
const WHEN_IN_USE = 4;

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
}

const started: Array<{ stop(): Promise<void> }> = [];
afterEach(async () => {
  while (started.length) await started.pop()!.stop();
});

function setup(permission: number, opts: { readyFails?: boolean } = {}) {
  const calls: string[] = [];
  let listener: ((l: any) => void) | null = null;
  const sent: TrackPoint[] = [];
  const lib: GeoLib = {
    ready: async () => {
      calls.push('ready');
      if (opts.readyFails) throw new Error('licenza');
    },
    start: async () => {
      calls.push('start');
    },
    stop: async () => {
      calls.push('stop');
    },
    requestPermission: async () => permission,
    onLocation: (cb) => {
      listener = cb;
      return { remove: () => calls.push('unsubscribe') };
    },
  };
  const buffer = new PointBuffer({
    store: memoryStore(),
    send: async (pts) => {
      calls.push(`send:${pts.length}`);
      sent.push(...pts);
    },
  });
  const tracker = createTracker({
    lib,
    buffer,
    ensureSignedIn: async () => {
      calls.push('signin');
    },
  });
  started.push(tracker);
  return { tracker, buffer, calls, sent, emit: (l: any) => listener!(l) };
}

const loc = (over: object = {}) => ({
  timestamp: '2026-11-22T10:00:00.000Z',
  coords: { latitude: 44.5, longitude: 11.3, accuracy: 7, speed: 12 },
  ...over,
});

test('permesso negato → "permission-denied" e nessun tracciamento avviato', async () => {
  const { tracker, calls } = setup(DENIED);
  expect(await tracker.start('s1')).toBe('permission-denied');
  expect(calls).not.toContain('start');
});

test('permesso solo in primo piano → "foreground-only" e nessun tracciamento avviato', async () => {
  const { tracker, calls } = setup(WHEN_IN_USE);
  expect(await tracker.start('s1')).toBe('foreground-only');
  expect(calls).not.toContain('start');
});

test('permesso sempre → "tracking": accesso al server e avvio della libreria', async () => {
  const { tracker, calls } = setup(ALWAYS);
  expect(await tracker.start('s1')).toBe('tracking');
  expect(calls).toEqual(expect.arrayContaining(['signin', 'ready', 'start']));
});

test('ogni posizione ricevuta diventa un TrackPoint nel buffer', async () => {
  const { tracker, buffer, emit, sent } = setup(ALWAYS);
  await tracker.start('s1');
  emit(loc());
  await tracker.stop();
  expect(await buffer.pendingCount()).toBe(0);
  expect(sent).toEqual([
    {
      sessionId: 's1',
      recordedAt: Date.parse('2026-11-22T10:00:00.000Z'),
      lat: 44.5,
      lng: 11.3,
      accuracy: 7,
      speed: 12,
    },
  ]);
});

test('velocità negativa (sconosciuta) diventa null; timestamp numerico accettato', async () => {
  const { tracker, emit, sent } = setup(ALWAYS);
  await tracker.start('s1');
  emit(loc({ timestamp: 1_700_000_000_000, coords: { latitude: 1, longitude: 2, speed: -1 } }));
  await tracker.stop();
  expect(sent[0].speed).toBeNull();
  expect(sent[0].accuracy).toBeNull();
  expect(sent[0].recordedAt).toBe(1_700_000_000_000);
});

test('stop esegue un flush prima di fermare la libreria', async () => {
  const { tracker, emit, calls } = setup(ALWAYS);
  await tracker.start('s1');
  emit(loc());
  await tracker.stop();
  expect(calls.indexOf('send:1')).toBeGreaterThan(-1);
  expect(calls.indexOf('send:1')).toBeLessThan(calls.indexOf('stop'));
});

test('un errore della libreria (es. licenza) dà "error" e non lancia', async () => {
  const { tracker } = setup(ALWAYS, { readyFails: true });
  await expect(tracker.start('s1')).resolves.toBe('error');
});

test('mentre traccia, invia i punti pendenti ogni 15 secondi', async () => {
  jest.useFakeTimers();
  try {
    const { tracker, emit, calls } = setup(ALWAYS);
    await tracker.start('s1');
    emit(loc());
    await jest.advanceTimersByTimeAsync(15_000);
    expect(calls).toContain('send:1');
    await tracker.stop();
  } finally {
    jest.useRealTimers();
  }
});

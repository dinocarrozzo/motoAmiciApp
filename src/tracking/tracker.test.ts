import { createHeadlessHandler, createTracker, SESSION_KEY, type GeoLib } from './tracker';
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

function setup(permission: number, opts: { readyFails?: boolean; enabled?: boolean; signInFails?: boolean; permissionRejects?: unknown } = {}) {
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
    requestPermission: async () => {
      if (opts.permissionRejects !== undefined) throw opts.permissionRejects;
      return permission;
    },
    isEnabled: async () => opts.enabled ?? false,
    onLocation: (cb) => {
      listener = cb;
      return { remove: () => calls.push('unsubscribe') };
    },
  };
  const store = memoryStore();
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
    store,
    ensureSignedIn: async () => {
      calls.push('signin');
      if (opts.signInFails) throw new Error('accesso anonimo disattivato');
    },
  });
  started.push(tracker);
  return { tracker, buffer, store, calls, sent, emit: (l: any) => listener!(l) };
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

test('start salva l\'id della sessione nello store e stop lo cancella', async () => {
  const { tracker, store } = setup(ALWAYS);
  await tracker.start('sess-42');
  expect(await store.getItem(SESSION_KEY)).toBe('sess-42');
  await tracker.stop();
  expect(await store.getItem(SESSION_KEY)).toBe('');
});

describe('gestore headless (app chiusa dal sistema)', () => {
  function headlessSetup(sessionId: string | null) {
    const store = memoryStore();
    const sent: TrackPoint[] = [];
    const buffer = new PointBuffer({
      store: memoryStore(),
      send: async (pts) => {
        sent.push(...pts);
      },
    });
    const handle = createHeadlessHandler({ buffer, store });
    return { handle, sent, store, ready: sessionId ? store.setItem(SESSION_KEY, sessionId) : Promise.resolve() };
  }

  test('un evento "location" con sessione salvata viene aggiunto e inviato', async () => {
    const { handle, sent, ready } = headlessSetup('sess-1');
    await ready;
    await handle({ name: 'location', params: loc() });
    expect(sent).toHaveLength(1);
    expect(sent[0].sessionId).toBe('sess-1');
  });

  test('senza sessione salvata l\'evento viene ignorato', async () => {
    const { handle, sent } = headlessSetup(null);
    await handle({ name: 'location', params: loc() });
    expect(sent).toEqual([]);
  });

  test('con sessione vuota (giro terminato) l\'evento viene ignorato', async () => {
    const { handle, sent, store } = headlessSetup('sess-1');
    await store.setItem(SESSION_KEY, '');
    await handle({ name: 'location', params: loc() });
    expect(sent).toEqual([]);
  });

  test('gli altri eventi non fanno nulla', async () => {
    const { handle, sent, ready } = headlessSetup('sess-1');
    await ready;
    await handle({ name: 'heartbeat', params: {} });
    expect(sent).toEqual([]);
  });
});

describe('restore (app riaperta mentre il servizio GPS è ancora attivo)', () => {
  test('con sessione salvata e servizio attivo → restituisce la sessione, senza riavviare', async () => {
    const { tracker, store, calls, emit, sent } = setup(ALWAYS, { enabled: true });
    await store.setItem(SESSION_KEY, 'sess-9');
    expect(await tracker.restore()).toBe('sess-9');
    expect(calls).not.toContain('start');
    emit(loc());
    await tracker.stop();
    expect(sent[0].sessionId).toBe('sess-9');
  });

  test('senza sessione salvata → null', async () => {
    const { tracker } = setup(ALWAYS, { enabled: true });
    expect(await tracker.restore()).toBeNull();
  });

  test('con sessione salvata ma servizio non attivo → null', async () => {
    const { tracker, store } = setup(ALWAYS, { enabled: false });
    await store.setItem(SESSION_KEY, 'sess-9');
    expect(await tracker.restore()).toBeNull();
  });
});

describe('lastError (dettaglio dell\'errore mostrato all\'utente)', () => {
  test('errore della libreria GPS → messaggio con il passaggio e la causa', async () => {
    const { tracker } = setup(ALWAYS, { readyFails: true });
    expect(await tracker.start('s1')).toBe('error');
    expect(tracker.lastError()).toBe('Libreria GPS: licenza');
  });

  test('errore di accesso a Supabase → messaggio con il passaggio e la causa', async () => {
    const { tracker } = setup(ALWAYS, { signInFails: true });
    expect(await tracker.start('s1')).toBe('error');
    expect(tracker.lastError()).toBe('Accesso a Supabase: accesso anonimo disattivato');
  });

  test('dopo un avvio riuscito lastError torna null', async () => {
    const { tracker } = setup(ALWAYS);
    await tracker.start('s1');
    expect(tracker.lastError()).toBeNull();
  });
});

describe('la libreria rifiuta la richiesta con il codice di stato', () => {
  test('rifiuto con 2 (negato) → "permission-denied", non "error"', async () => {
    const { tracker, calls } = setup(ALWAYS, { permissionRejects: 2 });
    expect(await tracker.start('s1')).toBe('permission-denied');
    expect(calls).not.toContain('start');
  });

  test('rifiuto con 5 (negato per sempre) → "permission-denied"', async () => {
    const { tracker } = setup(ALWAYS, { permissionRejects: 5 });
    expect(await tracker.start('s1')).toBe('permission-denied');
  });

  test('rifiuto con 4 (solo in uso) → "foreground-only"', async () => {
    const { tracker } = setup(ALWAYS, { permissionRejects: 4 });
    expect(await tracker.start('s1')).toBe('foreground-only');
  });

  test('un errore vero (non un codice) resta "error" con il dettaglio', async () => {
    const { tracker } = setup(ALWAYS, { permissionRejects: new Error('servizio non disponibile') });
    expect(await tracker.start('s1')).toBe('error');
    expect(tracker.lastError()).toBe('Permesso di posizione: servizio non disponibile');
  });
});

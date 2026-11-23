import type { KeyValueStore, PointBuffer } from './pointBuffer';
import type { TrackPoint } from './types';

export type TrackerStatus = 'tracking' | 'permission-denied' | 'foreground-only' | 'error';

/** La parte della libreria GPS che ci serve (permette una libreria finta nei test). */
export interface GeoLib {
  ready(config: Record<string, unknown>): Promise<unknown>;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  requestPermission(): Promise<number>;
  isEnabled(): Promise<boolean>;
  onLocation(cb: (location: any) => void): { remove(): void };
}

// Valori numerici di AuthorizationStatus della libreria.
const STATUS_ALWAYS = 3;
const STATUS_WHEN_IN_USE = 4;

export const FLUSH_INTERVAL_MS = 15_000;

/** Chiave dove si salva la sessione in corso, per il gestore headless. */
export const SESSION_KEY = 'motoamici.currentSession';

/** Configurazione di partenza, da tarare con la prova sul campo. */
export const TRACKER_CONFIG: Record<string, unknown> = {
  desiredAccuracy: -1, // High
  distanceFilter: 10, // metri
  stopTimeout: 5, // minuti di fermo prima di sospendere il tracciamento
  stopOnTerminate: false,
  startOnBoot: true,
  enableHeadless: true,
  heartbeatInterval: 60,
  locationAuthorizationRequest: 'Always',
  notification: {
    title: 'MotoAmici',
    text: 'MotoAmici sta tracciando il giro',
    sticky: true,
  },
};

function toPoint(sessionId: string, l: any): TrackPoint {
  const speed = typeof l.coords.speed === 'number' && l.coords.speed >= 0 ? l.coords.speed : null;
  return {
    sessionId,
    recordedAt: typeof l.timestamp === 'number' ? l.timestamp : Date.parse(l.timestamp),
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracy: typeof l.coords.accuracy === 'number' ? l.coords.accuracy : null,
    speed,
  };
}

export function createTracker(deps: {
  lib: GeoLib;
  buffer: PointBuffer;
  store: KeyValueStore;
  ensureSignedIn: () => Promise<void>;
}) {
  const { lib, buffer, store, ensureSignedIn } = deps;
  let readied = false;
  let subscription: { remove(): void } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastError: string | null = null;

  async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      lastError = `${name}: ${e instanceof Error ? e.message : String(e)}`;
      throw e;
    }
  }

  function attach(sessionId: string): void {
    subscription?.remove();
    subscription = lib.onLocation((l) => {
      buffer.add(toPoint(sessionId, l)).catch(() => undefined);
    });
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      buffer.flush().catch(() => undefined);
    }, FLUSH_INTERVAL_MS);
  }

  return {
    async start(sessionId: string): Promise<TrackerStatus> {
      lastError = null;
      try {
        await step('Accesso a Supabase', ensureSignedIn);
        const permission = await step('Permesso di posizione', async () => {
          try {
            return await lib.requestPermission();
          } catch (e) {
            // La libreria rifiuta la richiesta con il codice di stato (es. 2 = negato).
            if (typeof e === 'number') return e;
            throw e;
          }
        });
        if (permission === STATUS_WHEN_IN_USE) return 'foreground-only';
        if (permission !== STATUS_ALWAYS) return 'permission-denied';

        if (!readied) {
          await step('Libreria GPS', () => lib.ready(TRACKER_CONFIG));
          readied = true;
        }
        await store.setItem(SESSION_KEY, sessionId);
        attach(sessionId);
        await step('Libreria GPS', () => lib.start());
        return 'tracking';
      } catch {
        return 'error';
      }
    },

    /** Dettaglio dell'ultimo errore di avvio, da mostrare all'utente. */
    lastError(): string | null {
      return lastError;
    },

    /** App riaperta mentre il servizio GPS è ancora attivo: riprende l'ascolto della sessione in corso. */
    async restore(): Promise<string | null> {
      try {
        const sessionId = await store.getItem(SESSION_KEY);
        if (!sessionId || !(await lib.isEnabled())) return null;
        if (!readied) {
          await lib.ready(TRACKER_CONFIG);
          readied = true;
        }
        attach(sessionId);
        return sessionId;
      } catch {
        return null;
      }
    },

    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      await buffer.flush();
      await lib.stop();
      await store.setItem(SESSION_KEY, '');
      subscription?.remove();
      subscription = null;
    },
  };
}

/**
 * Gestore per quando il sistema chiude l'app ma il servizio GPS continua:
 * la libreria lo chiama in un contesto JavaScript senza interfaccia.
 */
export function createHeadlessHandler(deps: { buffer: PointBuffer; store: KeyValueStore }) {
  return async (event: { name: string; params: any }): Promise<void> => {
    if (event.name !== 'location') return;
    const sessionId = await deps.store.getItem(SESSION_KEY);
    if (!sessionId) return;
    await deps.buffer.add(toPoint(sessionId, event.params));
    await deps.buffer.flush();
  };
}

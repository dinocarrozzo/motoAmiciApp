import type { PointBuffer } from './pointBuffer';
import type { TrackPoint } from './types';

export type TrackerStatus = 'tracking' | 'permission-denied' | 'foreground-only' | 'error';

/** La parte della libreria GPS che ci serve (permette una libreria finta nei test). */
export interface GeoLib {
  ready(config: Record<string, unknown>): Promise<unknown>;
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  requestPermission(): Promise<number>;
  onLocation(cb: (location: any) => void): { remove(): void };
}

// Valori numerici di AuthorizationStatus della libreria.
const STATUS_ALWAYS = 3;
const STATUS_WHEN_IN_USE = 4;

export const FLUSH_INTERVAL_MS = 15_000;

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
  ensureSignedIn: () => Promise<void>;
}) {
  const { lib, buffer, ensureSignedIn } = deps;
  let readied = false;
  let subscription: { remove(): void } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    async start(sessionId: string): Promise<TrackerStatus> {
      try {
        await ensureSignedIn();
        const permission = await lib.requestPermission();
        if (permission === STATUS_WHEN_IN_USE) return 'foreground-only';
        if (permission !== STATUS_ALWAYS) return 'permission-denied';

        if (!readied) {
          await lib.ready(TRACKER_CONFIG);
          readied = true;
        }
        subscription?.remove();
        subscription = lib.onLocation((l) => {
          buffer.add(toPoint(sessionId, l)).catch(() => undefined);
        });
        await lib.start();
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
          buffer.flush().catch(() => undefined);
        }, FLUSH_INTERVAL_MS);
        return 'tracking';
      } catch {
        return 'error';
      }
    },

    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      await buffer.flush();
      await lib.stop();
      subscription?.remove();
      subscription = null;
    },
  };
}

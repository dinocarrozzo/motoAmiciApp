import type { TrackerStatus } from '../tracking/tracker';
import type { RideSettings, RideType } from './types';

/** Dentro un gruppo il tipo di uscita è quello del gruppo, quindi può mancare. */
export type StartSettings = Omit<RideSettings, 'rideType'> & { rideType: RideType | null };

const END_TIMEOUT_MS = 5000;

export function createRideController(deps: {
  api: { startRide(id: string, s: StartSettings, groupId?: string): Promise<void>; endRide(id: string): Promise<void> };
  tracker: { start(sessionId: string): Promise<TrackerStatus>; stop(): Promise<void> };
  newId: () => string;
}) {
  let current: string | null = null;

  async function endQuietly(id: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((res) => { timer = setTimeout(res, END_TIMEOUT_MS); });
    try {
      await Promise.race([deps.api.endRide(id).catch(() => undefined), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    async start(s: StartSettings, groupId?: string): Promise<{ status: TrackerStatus; rideId: string | null }> {
      const id = deps.newId();
      if (groupId) await deps.api.startRide(id, s, groupId);
      else await deps.api.startRide(id, s);
      let status: TrackerStatus;
      try {
        status = await deps.tracker.start(id);
      } catch (e) {
        await endQuietly(id);
        throw e;
      }
      if (status === 'permission-denied' || status === 'error') {
        await endQuietly(id);
        return { status, rideId: null };
      }
      current = id;
      return { status, rideId: id };
    },
    async stop(): Promise<void> {
      const id = current;
      current = null;
      await deps.tracker.stop();
      if (id) await endQuietly(id);
    },
    /** Dopo un riavvio dell'app con il tracciamento ancora attivo: riprende il giro in corso. */
    resume(id: string): void {
      current = id;
    },
    currentRideId: () => current,
  };
}

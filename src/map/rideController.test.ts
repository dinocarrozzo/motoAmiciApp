import { createRideController } from './rideController';
import type { TrackerStatus } from '../tracking/tracker';

const settings = { rideType: 'enduro' as const, visibility: 'all' as const, destination: null };

function setup(opts: { status?: TrackerStatus; startFails?: boolean; endFails?: boolean; endHangs?: boolean } = {}) {
  const log: string[] = [];
  const api = {
    startRide: async (id: string) => { log.push(`startRide:${id}`); if (opts.startFails) throw new Error('rete'); },
    endRide: (id: string) => {
      log.push(`endRide:${id}`);
      if (opts.endHangs) return new Promise<void>(() => {});
      return opts.endFails ? Promise.reject(new Error('rete')) : Promise.resolve();
    },
  };
  const tracker = {
    start: async (id: string) => { log.push(`trackStart:${id}`); return opts.status ?? 'tracking'; },
    stop: async () => { log.push('trackStop'); },
  };
  const c = createRideController({ api, tracker, newId: () => 'R1' });
  return { c, log };
}

test('start: crea il giro e poi avvia il tracciamento con lo stesso id', async () => {
  const { c, log } = setup();
  const r = await c.start(settings);
  expect(log).toEqual(['startRide:R1', 'trackStart:R1']);
  expect(r).toEqual({ status: 'tracking', rideId: 'R1' });
  expect(c.currentRideId()).toBe('R1');
});
test('startRide fallisce: rilancia e il tracciamento non parte', async () => {
  const { c, log } = setup({ startFails: true });
  await expect(c.start(settings)).rejects.toThrow('rete');
  expect(log).toEqual(['startRide:R1']);
  expect(c.currentRideId()).toBeNull();
});
test('permesso negato: il giro viene chiuso', async () => {
  const { c, log } = setup({ status: 'permission-denied' });
  const r = await c.start(settings);
  expect(r).toEqual({ status: 'permission-denied', rideId: null });
  expect(log).toEqual(['startRide:R1', 'trackStart:R1', 'endRide:R1']);
});
test('solo in primo piano: il giro resta attivo', async () => {
  const { c } = setup({ status: 'foreground-only' });
  expect((await c.start(settings)).rideId).toBe('R1');
});
test('stop: ferma il tracciamento e poi chiude il giro', async () => {
  const { c, log } = setup();
  await c.start(settings);
  log.length = 0;
  await c.stop();
  expect(log).toEqual(['trackStop', 'endRide:R1']);
  expect(c.currentRideId()).toBeNull();
});
test('stop termina anche se endRide fallisce', async () => {
  const { c } = setup({ endFails: true });
  await c.start(settings);
  await expect(c.stop()).resolves.toBeUndefined();
});
test('stop termina anche se endRide non risponde', async () => {
  jest.useFakeTimers();
  const { c } = setup({ endHangs: true });
  await c.start(settings);
  const p = c.stop();
  await jest.advanceTimersByTimeAsync(5001);
  await expect(p).resolves.toBeUndefined();
  jest.useRealTimers();
});
test('stop senza giro o ripetuto non richiama endRide', async () => {
  const { c, log } = setup();
  await c.stop();
  expect(log.filter((l) => l.startsWith('endRide'))).toEqual([]);
  await c.start(settings);
  await c.stop();
  await c.stop();
  expect(log.filter((l) => l.startsWith('endRide'))).toEqual(['endRide:R1']);
});

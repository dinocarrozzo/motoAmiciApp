import { createRidersFeed } from './useRiders';
import type { BBox, Rider } from './types';

const box = (lat: number, lng: number, size = 0.2): BBox => ({ minLat: lat, minLng: lng, maxLat: lat + size, maxLng: lng + size });
const rider = (id: string): Rider => ({ id, nickname: id, avatar: 'moto', gender: 'm', lat: 1, lng: 1, exact: true, isFriend: false, recordedAt: 0, rideType: null, bikeType: null, destination: null, groupId: null, memberCount: null });

function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setImmediate(r));

test('prima zona: una richiesta; spostamento piccolo: nessuna; grande: una', async () => {
  const fetch = jest.fn(async () => [rider('a')]);
  const feed = createRidersFeed({ fetch, onRiders: jest.fn(), onError: jest.fn() });
  feed.setBox(box(45, 9)); await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  feed.setBox(box(45.02, 9.02)); await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  feed.setBox(box(45.1, 9.1)); await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('refresh richiede la zona corrente anche senza spostamento', async () => {
  const fetch = jest.fn(async () => []);
  const feed = createRidersFeed({ fetch, onRiders: jest.fn(), onError: jest.fn() });
  await feed.refresh();
  expect(fetch).not.toHaveBeenCalled();
  feed.setBox(box(45, 9)); await flush();
  await feed.refresh();
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('risposta superata ignorata', async () => {
  const d1 = deferred<Rider[]>(); const d2 = deferred<Rider[]>();
  const fetch = jest.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
  const onRiders = jest.fn();
  const feed = createRidersFeed({ fetch, onRiders, onError: jest.fn() });
  feed.setBox(box(45, 9));
  feed.setBox(box(46, 10));
  d2.resolve([rider('nuova')]); await flush();
  d1.resolve([rider('vecchia')]); await flush();
  expect(onRiders).toHaveBeenCalledTimes(1);
  expect(onRiders).toHaveBeenCalledWith([rider('nuova')]);
});
test('errore: onError e nessun azzeramento', async () => {
  const fetch = jest.fn().mockRejectedValue(new Error('rete'));
  const onRiders = jest.fn(); const onError = jest.fn();
  const feed = createRidersFeed({ fetch, onRiders, onError });
  feed.setBox(box(45, 9)); await flush();
  expect(onError).toHaveBeenCalledWith('rete');
  expect(onRiders).not.toHaveBeenCalled();
});
test('dopo dispose non arriva più nulla', async () => {
  const d = deferred<Rider[]>();
  const onRiders = jest.fn(); const onError = jest.fn();
  const feed = createRidersFeed({ fetch: () => d.promise, onRiders, onError });
  feed.setBox(box(45, 9));
  feed.dispose();
  d.resolve([rider('a')]); await flush();
  feed.setBox(box(50, 10)); await flush();
  expect(onRiders).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

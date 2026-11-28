import { createGroupState, fetchAllGroupState, type GroupSnapshot } from './useGroupState';

const snap = (n: number): GroupSnapshot => ({ group: null, incoming: [], mine: [], invites: [{ groupId: String(n) } as any] });
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const flush = () => new Promise((r) => setImmediate(r));

test('risposta superata ignorata', async () => {
  const d1 = deferred<GroupSnapshot>(); const d2 = deferred<GroupSnapshot>();
  const fetchAll = jest.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
  const onSnapshot = jest.fn();
  const s = createGroupState({ fetchAll, onSnapshot });
  const p1 = s.refresh(); const p2 = s.refresh();
  d2.resolve(snap(2)); await p2; await flush();
  d1.resolve(snap(1)); await p1; await flush();
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  expect(onSnapshot).toHaveBeenCalledWith(snap(2));
});
test('errore: nessuna chiamata e refresh non rilancia', async () => {
  const onSnapshot = jest.fn();
  const s = createGroupState({ fetchAll: () => Promise.reject(new Error('rete')), onSnapshot });
  await expect(s.refresh()).resolves.toBeUndefined();
  expect(onSnapshot).not.toHaveBeenCalled();
});
test('dopo dispose nulla', async () => {
  const d = deferred<GroupSnapshot>();
  const onSnapshot = jest.fn();
  const s = createGroupState({ fetchAll: () => d.promise, onSnapshot });
  const p = s.refresh();
  s.dispose();
  d.resolve(snap(1)); await p; await flush();
  await s.refresh();
  expect(onSnapshot).not.toHaveBeenCalled();
});
test('fetchAllGroupState compone le quattro chiamate', async () => {
  const api = {
    myGroup: jest.fn().mockResolvedValue({ groupId: 'g' }),
    incomingRequests: jest.fn().mockResolvedValue([{ requestId: 'a' }]),
    myRequests: jest.fn().mockResolvedValue([{ requestId: 'b' }]),
    groupInvites: jest.fn().mockResolvedValue([{ groupId: 'x' }]),
  };
  const r = await fetchAllGroupState(api as any);
  expect(r).toEqual({ group: { groupId: 'g' }, incoming: [{ requestId: 'a' }], mine: [{ requestId: 'b' }], invites: [{ groupId: 'x' }] });
});

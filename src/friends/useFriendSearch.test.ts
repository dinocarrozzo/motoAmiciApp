import { createFriendSearch } from './useFriendSearch';
import type { ProfileSummary } from '../profile/types';

const p = (id: string): ProfileSummary => ({ id, nickname: id, displayName: null, avatar: 'moto', gender: 'x' });

function setup() {
  const pending: { q: string; resolve: (r: ProfileSummary[]) => void; reject: (e: Error) => void }[] = [];
  const search = jest.fn(
    (q: string) =>
      new Promise<ProfileSummary[]>((resolve, reject) => {
        pending.push({ q, resolve, reject });
      }),
  );
  const results: ProfileSummary[][] = [];
  const errors: string[] = [];
  const fs = createFriendSearch({ search, onResults: (r) => results.push(r), onError: (m) => errors.push(m) });
  return { fs, search, pending, results, errors };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('«m», «ma», «mar» in 100 ms → una sola ricerca, con «mar»', async () => {
  const { fs, search } = setup();
  fs.type('m');
  await jest.advanceTimersByTimeAsync(50);
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(50);
  fs.type('mar');
  await jest.advanceTimersByTimeAsync(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('mar');
});

test('sotto i 2 caratteri svuota i suggerimenti subito e non chiama il server', async () => {
  const { fs, search, results } = setup();
  fs.type('m');
  expect(results).toEqual([[]]);
  await jest.advanceTimersByTimeAsync(1000);
  expect(search).not.toHaveBeenCalled();
});

test('una risposta lenta per «ma» arrivata dopo quella per «mar» non sovrascrive i risultati', async () => {
  const { fs, pending, results } = setup();
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(300);
  fs.type('mar');
  await jest.advanceTimersByTimeAsync(300);
  pending[1].resolve([p('marta')]);
  await jest.advanceTimersByTimeAsync(0);
  pending[0].resolve([p('mario'), p('marco')]);
  await jest.advanceTimersByTimeAsync(0);
  expect(results[results.length - 1].map((x) => x.id)).toEqual(['marta']);
});

test('un errore di rete chiama onError e toglie i suggerimenti vecchi', async () => {
  const { fs, pending, results, errors } = setup();
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(300);
  pending[0].reject(new Error('rete assente'));
  await jest.advanceTimersByTimeAsync(0);
  expect(errors).toEqual(['rete assente']);
  expect(results[results.length - 1]).toEqual([]);
});

test('l\'errore di una ricerca superata viene ignorato', async () => {
  const { fs, pending, errors } = setup();
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(300);
  fs.type('mar');
  await jest.advanceTimersByTimeAsync(300);
  pending[0].reject(new Error('vecchio errore'));
  await jest.advanceTimersByTimeAsync(0);
  expect(errors).toEqual([]);
});

test('se si cancella il testo mentre una ricerca è in corso, la risposta tardiva viene ignorata', async () => {
  const { fs, pending, results } = setup();
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(300);
  fs.type('m');
  pending[0].resolve([p('mario')]);
  await jest.advanceTimersByTimeAsync(0);
  expect(results[results.length - 1]).toEqual([]);
});

test('dopo dispose() non arriva più nulla', async () => {
  const { fs, pending, results, errors } = setup();
  fs.type('ma');
  await jest.advanceTimersByTimeAsync(300);
  const before = results.length;
  fs.dispose();
  pending[0].resolve([p('mario')]);
  await jest.advanceTimersByTimeAsync(1000);
  fs.type('mar');
  await jest.advanceTimersByTimeAsync(1000);
  expect(results.length).toBe(before);
  expect(errors).toEqual([]);
});

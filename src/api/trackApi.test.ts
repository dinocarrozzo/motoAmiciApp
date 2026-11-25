import { createTrackApi, type TrackClient } from './trackApi';
import type { TrackPoint } from '../tracking/types';

const pt = (n: number): TrackPoint => ({
  sessionId: '11111111-1111-1111-1111-111111111111',
  recordedAt: Date.UTC(2026, 10, 22, 10, 0, n),
  lat: 44.5,
  lng: 11.3,
  accuracy: 5,
  speed: null,
});

function fakeClient(opts: { session?: boolean; upsertError?: string } = {}) {
  const calls = { upsert: [] as unknown[][] };
  const client: TrackClient = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ? {} : null } }),
    },
    from: (table: string) => ({
      upsert: async (rows: unknown, options: unknown) => {
        calls.upsert.push([table, rows, options]);
        return { error: opts.upsertError ? { message: opts.upsertError } : null };
      },
    }),
  };
  return { client, calls };
}

test('sendPoints converte recordedAt in ISO e fa upsert ignorando i duplicati', async () => {
  const { client, calls } = fakeClient();
  await createTrackApi(client).sendPoints([pt(1)]);
  expect(calls.upsert).toEqual([
    [
      'track_points',
      [
        {
          session_id: '11111111-1111-1111-1111-111111111111',
          recorded_at: '2026-11-22T10:00:01.000Z',
          lat: 44.5,
          lng: 11.3,
          accuracy: 5,
          speed: null,
        },
      ],
      { onConflict: 'session_id,recorded_at', ignoreDuplicates: true },
    ],
  ]);
});

test('un errore del client viene rilanciato', async () => {
  const { client } = fakeClient({ upsertError: 'rete assente' });
  await expect(createTrackApi(client).sendPoints([pt(1)])).rejects.toThrow('rete assente');
});

test('sendPoints con lista vuota non chiama il server', async () => {
  const { client, calls } = fakeClient();
  await createTrackApi(client).sendPoints([]);
  expect(calls.upsert).toEqual([]);
});

test('ensureSignedIn con una sessione non fa nulla', async () => {
  const { client } = fakeClient({ session: true });
  await expect(createTrackApi(client).ensureSignedIn()).resolves.toBeUndefined();
});

test('ensureSignedIn senza sessione lancia «Accedi per continuare» (niente accesso anonimo)', async () => {
  const { client } = fakeClient({ session: false });
  await expect(createTrackApi(client).ensureSignedIn()).rejects.toThrow('Accedi per continuare');
});

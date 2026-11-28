import { createRidersApi } from './ridersApi';

const settings = { rideType: 'enduro' as const, visibility: 'friends' as const, destination: 'Lago' };

function fake(result: { data: any; error: { message: string } | null } = { data: null, error: null }) {
  const calls: Array<[string, any]> = [];
  return { calls, client: { rpc: (fn: string, args?: any) => { calls.push([fn, args]); return Promise.resolve(result); } } };
}

test('startRide', async () => {
  const f = fake();
  await createRidersApi(f.client).startRide('id1', settings);
  expect(f.calls).toEqual([['start_ride', { p_ride_id: 'id1', p_ride_type: 'enduro', p_visibility: 'friends', p_destination: 'Lago' }]]);
});
test('endRide', async () => {
  const f = fake();
  await createRidersApi(f.client).endRide('id1');
  expect(f.calls).toEqual([['end_ride', { p_ride_id: 'id1' }]]);
});
test('inArea riduce la zona troppo larga', async () => {
  const f = fake({ data: [], error: null });
  await createRidersApi(f.client).inArea({ minLat: 40, minLng: 8, maxLat: 43, maxLng: 11 });
  const a = f.calls[0][1];
  expect(a.max_lat - a.min_lat).toBeCloseTo(1);
  expect(a.max_lng - a.min_lng).toBeCloseTo(1);
});
test('inArea converte le righe', async () => {
  const row = { id: 'u', nickname: 'bruno', avatar: 'moto', gender: 'm', lat: 45, lng: 9, exact: false, is_friend: true,
    recorded_at: '2026-11-27T10:00:00Z', ride_type: 'enduro', bike_type: null, destination: null };
  const f = fake({ data: [row], error: null });
  const r = await createRidersApi(f.client).inArea({ minLat: 45, minLng: 9, maxLat: 45.1, maxLng: 9.1 });
  expect(f.calls[0][0]).toBe('riders_in_area');
  expect(r).toEqual([{ id: 'u', nickname: 'bruno', avatar: 'moto', gender: 'm', lat: 45, lng: 9, exact: false, isFriend: true,
    recordedAt: Date.parse('2026-11-27T10:00:00Z'), rideType: 'enduro', bikeType: null, destination: null, groupId: null, memberCount: null }]);
});
test('risposta vuota o null', async () => {
  expect(await createRidersApi(fake().client).inArea({ minLat: 1, minLng: 1, maxLat: 1.1, maxLng: 1.1 })).toEqual([]);
});
test('errore del server', async () => {
  const f = fake({ data: null, error: { message: 'Zona troppo ampia' } });
  await expect(createRidersApi(f.client).inArea({ minLat: 1, minLng: 1, maxLat: 1.1, maxLng: 1.1 })).rejects.toThrow('Zona troppo ampia');
});

test('startRide dentro un gruppo: passa il gruppo e nessun tipo', async () => {
  const f = fake();
  await createRidersApi(f.client).startRide('id1', { rideType: null, visibility: 'all', destination: null }, 'g1');
  expect(f.calls).toEqual([['start_ride', { p_ride_id: 'id1', p_ride_type: null, p_visibility: 'all', p_destination: null, p_group_id: 'g1' }]]);
});
test('inArea converte group_id e member_count', async () => {
  const row = { id: 'u', nickname: 'a', avatar: 'moto', gender: 'm', lat: 45, lng: 9, exact: true, is_friend: false, recorded_at: '2026-11-27T10:00:00Z', ride_type: null, bike_type: null, destination: null, group_id: 'g', member_count: 4 };
  const r = await createRidersApi(fake({ data: [row], error: null }).client).inArea({ minLat: 45, minLng: 9, maxLat: 45.1, maxLng: 9.1 });
  expect(r[0].groupId).toBe('g');
  expect(r[0].memberCount).toBe(4);
  const n = await createRidersApi(fake({ data: [{ ...row, group_id: null, member_count: null }], error: null }).client).inArea({ minLat: 45, minLng: 9, maxLat: 45.1, maxLng: 9.1 });
  expect(n[0].groupId).toBeNull();
  expect(n[0].memberCount).toBeNull();
});

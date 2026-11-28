import { createGroupsApi } from './groupsApi';

type Res = { data: any; error: { message: string } | null };
function fake(result: Res = { data: null, error: null }) {
  const calls: Array<[string, any]> = [];
  return { calls, client: { rpc: (fn: string, args?: any) => { calls.push([fn, args]); return Promise.resolve(result); } } };
}

test('myGroup converte la riga e ritorna null se vuota', async () => {
  const row = { group_id: 'g', ride_type: 'enduro', destination: null, invite_code: 'ABC234', role: 'owner', member_count: 3, ride_id: 'r' };
  const f = fake({ data: [row], error: null });
  expect(await createGroupsApi(f.client).myGroup()).toEqual({ groupId: 'g', rideType: 'enduro', destination: null, inviteCode: 'ABC234', role: 'owner', memberCount: 3, rideId: 'r' });
  expect(f.calls[0]).toEqual(['my_group', undefined]);
  expect(await createGroupsApi(fake({ data: [], error: null }).client).myGroup()).toBeNull();
});
test('participants', async () => {
  const f = fake({ data: [{ id: 'u', nickname: 'ann', avatar: 'moto', gender: 'f', role: 'member', riding: true }], error: null });
  const r = await createGroupsApi(f.client).participants('g1');
  expect(f.calls[0]).toEqual(['group_participants', { p_group_id: 'g1' }]);
  expect(r).toEqual([{ id: 'u', nickname: 'ann', avatar: 'moto', gender: 'f', role: 'member', riding: true }]);
});
test('requestJoin passa i parametri e restituisce l\'id', async () => {
  const f = fake({ data: 'req-1', error: null });
  expect(await createGroupsApi(f.client).requestJoin('g1', 'Ciao')).toBe('req-1');
  expect(f.calls[0]).toEqual(['request_join', { p_group_id: 'g1', p_message: 'Ciao' }]);
});
test('cancelRequest', async () => {
  const f = fake();
  await createGroupsApi(f.client).cancelRequest('r1');
  expect(f.calls[0]).toEqual(['cancel_join_request', { p_request_id: 'r1' }]);
});
test('respond con punto e senza punto', async () => {
  const f = fake();
  await createGroupsApi(f.client).respond('r1', true, { lat: 45, lng: 9 }, 'Bar');
  await createGroupsApi(f.client).respond('r1', false, null, null);
  expect(f.calls[0]).toEqual(['respond_join_request', { p_request_id: 'r1', p_accept: true, p_meet_lat: 45, p_meet_lng: 9, p_note: 'Bar' }]);
  expect(f.calls[1]).toEqual(['respond_join_request', { p_request_id: 'r1', p_accept: false, p_meet_lat: null, p_meet_lng: null, p_note: null }]);
});
test('incomingRequests', async () => {
  const f = fake({ data: [{ request_id: 'r', group_id: 'g', requester_id: 'u', nickname: 'dario', avatar: 'moto', gender: 'm', message: null, created_at: '2026-11-28T10:00:00Z' }], error: null });
  expect(await createGroupsApi(f.client).incomingRequests()).toEqual([{ requestId: 'r', groupId: 'g', requesterId: 'u', nickname: 'dario', avatar: 'moto', gender: 'm', message: null, createdAt: Date.parse('2026-11-28T10:00:00Z') }]);
});
test('myRequests: punto d\'incontro solo se lat e lng ci sono', async () => {
  const f = fake({ data: [
    { request_id: 'a', group_id: 'g', status: 'accepted', meet_lat: 45, meet_lng: 9, meet_note: 'Bar', answered_at: '2026-11-28T10:05:00Z', created_at: '2026-11-28T10:00:00Z' },
    { request_id: 'b', group_id: 'g', status: 'pending', meet_lat: null, meet_lng: null, meet_note: null, answered_at: null, created_at: '2026-11-28T10:00:00Z' },
  ], error: null });
  const r = await createGroupsApi(f.client).myRequests();
  expect(r[0].meet).toEqual({ lat: 45, lng: 9 });
  expect(r[0].answeredAt).toBe(Date.parse('2026-11-28T10:05:00Z'));
  expect(r[1].meet).toBeNull();
  expect(r[1].answeredAt).toBeNull();
});
test('joinByCode, inviteFriend, groupInvites, respondInvite', async () => {
  const f = fake({ data: 'g1', error: null });
  const api = createGroupsApi(f.client);
  expect(await api.joinByCode('ABC234')).toBe('g1');
  await api.inviteFriend('g1', 'u1');
  await api.respondInvite('g1', true);
  expect(f.calls.map((c) => c[0])).toEqual(['join_by_code', 'invite_to_group', 'respond_group_invite']);
  expect(f.calls[0][1]).toEqual({ p_code: 'ABC234' });
  expect(f.calls[1][1]).toEqual({ p_group_id: 'g1', p_user_id: 'u1' });
  expect(f.calls[2][1]).toEqual({ p_group_id: 'g1', p_accept: true });
  const g = fake({ data: [{ group_id: 'g', inviter_nickname: 'anna', ride_type: 'enduro', destination: 'Lago', created_at: '2026-11-28T10:00:00Z' }], error: null });
  expect(await createGroupsApi(g.client).groupInvites()).toEqual([{ groupId: 'g', inviterNickname: 'anna', rideType: 'enduro', destination: 'Lago', createdAt: Date.parse('2026-11-28T10:00:00Z') }]);
});
test('errore del server rilanciato', async () => {
  const f = fake({ data: null, error: { message: 'Richiesta già gestita' } });
  await expect(createGroupsApi(f.client).respond('r', true, null, null)).rejects.toThrow('Richiesta già gestita');
});

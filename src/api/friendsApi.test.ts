import { createFriendsApi, type RpcClient } from './friendsApi';

function fake(responses: Record<string, { data?: any; error?: { message: string } | null }> = {}) {
  const calls: { fn: string; args?: any }[] = [];
  const client: RpcClient = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      const r = responses[fn] ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  return { client, calls };
}

const rows = [{ id: 'u1', nickname: 'marta', display_name: 'Marta B', avatar: 'volpe', gender: 'f' }];

test('search con meno di 2 caratteri non chiama il server', async () => {
  const { client, calls } = fake();
  expect(await createFriendsApi(client).search('m')).toEqual([]);
  expect(await createFriendsApi(client).search('  ')).toEqual([]);
  expect(calls).toEqual([]);
});
test('search passa il testo già pulito e converte le righe', async () => {
  const { client, calls } = fake({ search_profiles: { data: rows } });
  const res = await createFriendsApi(client).search(' Ma%r ');
  expect(calls).toEqual([{ fn: 'search_profiles', args: { q: 'Mar' } }]);
  expect(res).toEqual([{ id: 'u1', nickname: 'marta', displayName: 'Marta B', avatar: 'volpe', gender: 'f' }]);
});
test('sendRequest, remove, block, unblock chiamano le funzioni giuste con target_id', async () => {
  const { client, calls } = fake();
  const api = createFriendsApi(client);
  await api.sendRequest('u1');
  await api.remove('u1');
  await api.block('u1');
  await api.unblock('u1');
  expect(calls).toEqual([
    { fn: 'send_friend_request', args: { target_id: 'u1' } },
    { fn: 'remove_friend', args: { target_id: 'u1' } },
    { fn: 'block_user', args: { target_id: 'u1' } },
    { fn: 'unblock_user', args: { target_id: 'u1' } },
  ]);
});
test('respond usa requester_id e accept', async () => {
  const { client, calls } = fake();
  await createFriendsApi(client).respond('u1', true);
  expect(calls).toEqual([{ fn: 'respond_friend_request', args: { requester_id: 'u1', accept: true } }]);
});
test('un errore del server diventa un Error con lo stesso messaggio', async () => {
  const { client } = fake({ send_friend_request: { error: { message: 'Richiesta già inviata' } } });
  await expect(createFriendsApi(client).sendRequest('u1')).rejects.toThrow('Richiesta già inviata');
});
test('list divide amici, richieste ricevute e inviate', async () => {
  const { client } = fake({
    list_friends: { data: rows },
    list_requests: {
      data: [
        { id: 'r1', nickname: 'a', display_name: null, avatar: 'moto', gender: 'x', direction: 'received' },
        { id: 's1', nickname: 'b', display_name: null, avatar: 'moto', gender: 'x', direction: 'sent' },
      ],
    },
  });
  const res = await createFriendsApi(client).list();
  expect(res.friends.map((p) => p.id)).toEqual(['u1']);
  expect(res.received.map((p) => p.id)).toEqual(['r1']);
  expect(res.sent.map((p) => p.id)).toEqual(['s1']);
});
test('list con risposte vuote (null) → elenchi vuoti', async () => {
  const res = await createFriendsApi(fake().client).list();
  expect(res).toEqual({ friends: [], received: [], sent: [] });
});
test('listBlocked converte le righe', async () => {
  const { client } = fake({ list_blocked: { data: rows } });
  expect((await createFriendsApi(client).listBlocked())[0].displayName).toBe('Marta B');
});

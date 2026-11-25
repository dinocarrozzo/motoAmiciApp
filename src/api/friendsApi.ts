import { normalizeQuery } from '../friends/search';
import type { ProfileSummary } from '../profile/types';

/** La parte del client Supabase che ci serve per gli amici (permette un client finto nei test). */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }>;
}

const toSummary = (r: any): ProfileSummary => ({
  id: r.id,
  nickname: r.nickname,
  displayName: r.display_name ?? null,
  avatar: r.avatar,
  gender: r.gender,
});

export function createFriendsApi(client: RpcClient) {
  async function call(fn: string, args?: Record<string, unknown>): Promise<any[]> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  }

  return {
    async search(q: string): Promise<ProfileSummary[]> {
      const query = normalizeQuery(q);
      if (query === null) return [];
      return (await call('search_profiles', { q: query })).map(toSummary);
    },
    async sendRequest(id: string): Promise<void> {
      await call('send_friend_request', { target_id: id });
    },
    async respond(id: string, accept: boolean): Promise<void> {
      await call('respond_friend_request', { requester_id: id, accept });
    },
    async remove(id: string): Promise<void> {
      await call('remove_friend', { target_id: id });
    },
    async block(id: string): Promise<void> {
      await call('block_user', { target_id: id });
    },
    async unblock(id: string): Promise<void> {
      await call('unblock_user', { target_id: id });
    },
    async list(): Promise<{ friends: ProfileSummary[]; received: ProfileSummary[]; sent: ProfileSummary[] }> {
      const [friends, requests] = await Promise.all([call('list_friends'), call('list_requests')]);
      return {
        friends: friends.map(toSummary),
        received: requests.filter((r) => r.direction === 'received').map(toSummary),
        sent: requests.filter((r) => r.direction === 'sent').map(toSummary),
      };
    },
    async listBlocked(): Promise<ProfileSummary[]> {
      return (await call('list_blocked')).map(toSummary);
    },
  };
}

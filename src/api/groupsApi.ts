import type { GroupInvite, IncomingRequest, MeetPoint, MyGroup, MyRequest, Participant } from '../groups/types';
import type { RpcClient } from './friendsApi';

const ms = (iso: string | null | undefined): number | null => (iso ? Date.parse(iso) : null);

export function createGroupsApi(client: RpcClient) {
  async function raw(fn: string, args?: Record<string, unknown>): Promise<any> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  }
  const rows = async (fn: string, args?: Record<string, unknown>): Promise<any[]> => {
    const d = await raw(fn, args);
    return Array.isArray(d) ? d : [];
  };

  return {
    async myGroup(): Promise<MyGroup | null> {
      const [r] = await rows('my_group');
      if (!r) return null;
      return {
        groupId: r.group_id, rideType: r.ride_type, destination: r.destination ?? null, inviteCode: r.invite_code,
        role: r.role, memberCount: r.member_count, rideId: r.ride_id ?? null,
      };
    },
    async participants(groupId: string): Promise<Participant[]> {
      return (await rows('group_participants', { p_group_id: groupId })).map((r) => ({
        id: r.id, nickname: r.nickname, avatar: r.avatar, gender: r.gender, role: r.role, riding: !!r.riding,
      }));
    },
    async requestJoin(groupId: string, message: string | null): Promise<string> {
      return String(await raw('request_join', { p_group_id: groupId, p_message: message }));
    },
    async cancelRequest(requestId: string): Promise<void> {
      await raw('cancel_join_request', { p_request_id: requestId });
    },
    async respond(requestId: string, accept: boolean, meet: MeetPoint, note: string | null): Promise<void> {
      await raw('respond_join_request', {
        p_request_id: requestId, p_accept: accept, p_meet_lat: meet ? meet.lat : null, p_meet_lng: meet ? meet.lng : null, p_note: note,
      });
    },
    async incomingRequests(): Promise<IncomingRequest[]> {
      return (await rows('list_incoming_requests')).map((r) => ({
        requestId: r.request_id, groupId: r.group_id, requesterId: r.requester_id, nickname: r.nickname,
        avatar: r.avatar, gender: r.gender, message: r.message ?? null, createdAt: Date.parse(r.created_at),
      }));
    },
    async myRequests(): Promise<MyRequest[]> {
      return (await rows('list_my_requests')).map((r) => ({
        requestId: r.request_id, groupId: r.group_id, status: r.status,
        meet: r.meet_lat != null && r.meet_lng != null ? { lat: r.meet_lat, lng: r.meet_lng } : null,
        meetNote: r.meet_note ?? null, answeredAt: ms(r.answered_at), createdAt: Date.parse(r.created_at),
      }));
    },
    async joinByCode(code: string): Promise<string> {
      return String(await raw('join_by_code', { p_code: code }));
    },
    async inviteFriend(groupId: string, userId: string): Promise<void> {
      await raw('invite_to_group', { p_group_id: groupId, p_user_id: userId });
    },
    async groupInvites(): Promise<GroupInvite[]> {
      return (await rows('list_group_invites')).map((r) => ({
        groupId: r.group_id, inviterNickname: r.inviter_nickname, rideType: r.ride_type,
        destination: r.destination ?? null, createdAt: Date.parse(r.created_at),
      }));
    },
    async respondInvite(groupId: string, accept: boolean): Promise<void> {
      await raw('respond_group_invite', { p_group_id: groupId, p_accept: accept });
    },
  };
}

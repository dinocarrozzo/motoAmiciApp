import type { createGroupsApi } from '../api/groupsApi';
import type { GroupInvite, IncomingRequest, MyGroup, MyRequest } from './types';

export type GroupSnapshot = { group: MyGroup | null; incoming: IncomingRequest[]; mine: MyRequest[]; invites: GroupInvite[] };

export async function fetchAllGroupState(api: Pick<ReturnType<typeof createGroupsApi>, 'myGroup' | 'incomingRequests' | 'myRequests' | 'groupInvites'>): Promise<GroupSnapshot> {
  const [group, incoming, mine, invites] = await Promise.all([api.myGroup(), api.incomingRequests(), api.myRequests(), api.groupInvites()]);
  return { group, incoming, mine, invites };
}

/** Rilegge gruppo, richieste e inviti. Ignora le risposte superate; un errore di rete non rompe nulla. */
export function createGroupState(deps: { fetchAll: () => Promise<GroupSnapshot>; onSnapshot: (s: GroupSnapshot) => void }) {
  let seq = 0;
  let disposed = false;
  return {
    async refresh(): Promise<void> {
      if (disposed) return;
      const mine = ++seq;
      try {
        const s = await deps.fetchAll();
        if (!disposed && mine === seq) deps.onSnapshot(s);
      } catch {
        // al prossimo giro si riprova
      }
    },
    dispose(): void {
      disposed = true;
    },
  };
}

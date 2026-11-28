import { isMeetPointFresh } from './meetPoint';
import type { GroupInvite, IncomingRequest, MyGroup, MyRequest } from './types';

const HOUR = 3_600_000;

export type RequestState =
  | { kind: 'member' }
  | { kind: 'can-request' }
  | { kind: 'pending'; requestId: string }
  | { kind: 'wait'; waitMinutes: number };

/** Cosa mostrare sul bottone «Chiedi di unirti» per un gruppo. */
export function requestStateFor(groupId: string, myGroupId: string | null, mine: MyRequest[], now: number): RequestState {
  if (groupId === myGroupId) return { kind: 'member' };
  const here = mine.filter((r) => r.groupId === groupId);
  const pending = here.find((r) => r.status === 'pending');
  if (pending) return { kind: 'pending', requestId: pending.requestId };
  const lastDecline = Math.max(0, ...here.filter((r) => r.status === 'declined' && r.answeredAt).map((r) => r.answeredAt as number));
  if (lastDecline && now - lastDecline < HOUR) return { kind: 'wait', waitMinutes: Math.ceil((HOUR - (now - lastDecline)) / 60_000) };
  return { kind: 'can-request' };
}

/** Numero sul pulsante degli avvisi. `answered` = risposte alle mie richieste non ancora viste. */
export const badgeCount = (s: { incoming: IncomingRequest[]; invites: GroupInvite[]; answered: MyRequest[] }): number =>
  s.incoming.length + s.invites.length + s.answered.length;

/**
 * Risposte alle mie richieste da mostrare: recenti (24 ore), non ancora viste.
 * Un'accettazione resta visibile solo finché sono nel gruppo e non ho ancora avviato il giro con quel gruppo.
 */
export function visibleAnswers(mine: MyRequest[], group: Pick<MyGroup, 'groupId' | 'rideId'> | null, now: number, seen: string[]): MyRequest[] {
  return mine.filter((r) => {
    if ((r.status !== 'accepted' && r.status !== 'declined') || seen.includes(r.requestId) || !isMeetPointFresh(r.answeredAt, now)) return false;
    if (r.status === 'declined') return true;
    return group !== null && group.groupId === r.groupId && group.rideId === null;
  });
}

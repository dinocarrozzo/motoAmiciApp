import type { Block, Friendship } from '../profile/types';

export type Relationship = 'none' | 'friends' | 'request-sent' | 'request-received' | 'blocked-by-me';

/**
 * Com'è il legame tra me e un altro utente. Chi mi ha bloccato per me non esiste:
 * il server non me lo mostra mai, quindi qui conta come «nessun legame».
 */
export function relationshipWith(me: string, other: string, friendships: Friendship[], blocks: Block[]): Relationship {
  if (blocks.some((b) => b.blocker === me && b.blocked === other)) return 'blocked-by-me';
  const f = friendships.find(
    (x) => (x.requester === me && x.addressee === other) || (x.requester === other && x.addressee === me),
  );
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester === me ? 'request-sent' : 'request-received';
}

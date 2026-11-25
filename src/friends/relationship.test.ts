import { relationshipWith } from './relationship';
import type { Block, Friendship } from '../profile/types';

const me = 'me';
const other = 'other';

test('nessun legame → none', () => {
  expect(relationshipWith(me, other, [], [])).toBe('none');
});
test('richiesta inviata da me → request-sent', () => {
  const f: Friendship[] = [{ requester: me, addressee: other, status: 'pending' }];
  expect(relationshipWith(me, other, f, [])).toBe('request-sent');
});
test("richiesta ricevuta dall'altro → request-received", () => {
  const f: Friendship[] = [{ requester: other, addressee: me, status: 'pending' }];
  expect(relationshipWith(me, other, f, [])).toBe('request-received');
});
test('amicizia accettata, in un verso o nell\'altro → friends', () => {
  expect(relationshipWith(me, other, [{ requester: me, addressee: other, status: 'accepted' }], [])).toBe('friends');
  expect(relationshipWith(me, other, [{ requester: other, addressee: me, status: 'accepted' }], [])).toBe('friends');
});
test('bloccato da me → blocked-by-me, con precedenza su friends', () => {
  const f: Friendship[] = [{ requester: me, addressee: other, status: 'accepted' }];
  const b: Block[] = [{ blocker: me, blocked: other }];
  expect(relationshipWith(me, other, f, b)).toBe('blocked-by-me');
});
test("se è l'altro ad avermi bloccato, per me è come se non esistesse → none", () => {
  const b: Block[] = [{ blocker: other, blocked: me }];
  expect(relationshipWith(me, other, [], b)).toBe('none');
});
test('ignora i legami con terze persone', () => {
  const f: Friendship[] = [{ requester: me, addressee: 'terzo', status: 'accepted' }];
  expect(relationshipWith(me, other, f, [{ blocker: me, blocked: 'terzo' }])).toBe('none');
});

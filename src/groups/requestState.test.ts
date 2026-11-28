import { requestStateFor, badgeCount } from './requestState';
import type { MyRequest } from './types';

const NOW = 1_000_000_000_000;
const req = (o: Partial<MyRequest>): MyRequest => ({ requestId: 'r', groupId: 'g', status: 'pending', meet: null, meetNote: null, answeredAt: null, createdAt: NOW - 1000, ...o });

test('stesso gruppo → member', () => {
  expect(requestStateFor('g', 'g', [], NOW).kind).toBe('member');
});
test('nessuna richiesta → can-request', () => {
  expect(requestStateFor('g', null, [], NOW).kind).toBe('can-request');
});
test('pending → pending con id', () => {
  expect(requestStateFor('g', null, [req({ requestId: 'x' })], NOW)).toEqual({ kind: 'pending', requestId: 'x' });
});
test('rifiutata 20 minuti fa → wait 40', () => {
  expect(requestStateFor('g', null, [req({ status: 'declined', answeredAt: NOW - 20 * 60_000 })], NOW)).toEqual({ kind: 'wait', waitMinutes: 40 });
});
test('rifiutata 61 minuti fa → can-request', () => {
  expect(requestStateFor('g', null, [req({ status: 'declined', answeredAt: NOW - 61 * 60_000 })], NOW).kind).toBe('can-request');
});
test('annullata o di un altro gruppo → can-request', () => {
  expect(requestStateFor('g', null, [req({ status: 'cancelled' })], NOW).kind).toBe('can-request');
  expect(requestStateFor('g', null, [req({ groupId: 'altro' })], NOW).kind).toBe('can-request');
});
test('badgeCount somma le tre liste', () => {
  expect(badgeCount({ incoming: [{} as any, {} as any], invites: [{} as any], answered: [req({}), req({}), req({})] })).toBe(6);
});

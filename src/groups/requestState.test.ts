import { requestStateFor, badgeCount, visibleAnswers } from './requestState';
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

const G = (o: object) => ({ groupId: 'g', rideId: null, ...o }) as any;
test('visibleAnswers: accettata e sono nel gruppo, non ancora in giro → visibile', () => {
  const a = req({ status: 'accepted', answeredAt: NOW - 1000 });
  expect(visibleAnswers([a], G({}), NOW, [])).toEqual([a]);
});
test('visibleAnswers: accettata ma sono già in giro nel gruppo → nascosta', () => {
  expect(visibleAnswers([req({ status: 'accepted', answeredAt: NOW - 1000 })], G({ rideId: 'r' }), NOW, [])).toEqual([]);
});
test('visibleAnswers: accettata ma il gruppo non c\'è più → nascosta', () => {
  expect(visibleAnswers([req({ status: 'accepted', answeredAt: NOW - 1000 })], null, NOW, [])).toEqual([]);
});
test('visibleAnswers: rifiutata recente visibile; già vista o vecchia no; pending mai', () => {
  const d = req({ requestId: 'd', status: 'declined', answeredAt: NOW - 1000 });
  expect(visibleAnswers([d], null, NOW, [])).toEqual([d]);
  expect(visibleAnswers([d], null, NOW, ['d'])).toEqual([]);
  expect(visibleAnswers([req({ status: 'declined', answeredAt: NOW - 25 * 3_600_000 })], null, NOW, [])).toEqual([]);
  expect(visibleAnswers([req({})], null, NOW, [])).toEqual([]);
});

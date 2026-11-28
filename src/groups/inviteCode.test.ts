import { normalizeInviteCode } from './inviteCode';

test('toglie spazi e trattini e mette le maiuscole', () => {
  expect(normalizeInviteCode('ab c-234')).toBe('ABC234');
});
test('codici non validi → null', () => {
  for (const c of ['', 'abc', 'ABCDEF!', 'ABCDE0', 'ABCDEI', 'ABCDEFG']) expect(normalizeInviteCode(c)).toBeNull();
});

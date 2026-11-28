import { buildGroupInviteMessage, groupInviteWhatsappUrl, INVITE_BASE_URL } from './inviteMessage';

test('contiene link, codice e destinazione', () => {
  const m = buildGroupInviteMessage({ nickname: 'marco', destination: 'Lago', code: 'ABC234' });
  expect(m).toContain('https://www.motoamiciapp.it/invito/ABC234');
  expect(m).toContain('ABC234');
  expect(m).toContain('Lago');
  expect(m).toContain('marco');
  expect(INVITE_BASE_URL).toBe('https://www.motoamiciapp.it/invito/');
});
test('senza destinazione niente "null"', () => {
  const m = buildGroupInviteMessage({ nickname: 'marco', destination: null, code: 'ABC234' });
  expect(m).not.toContain('null');
});
test('URL WhatsApp codificato', () => {
  const u = groupInviteWhatsappUrl('ciao & a presto');
  expect(u.startsWith('https://wa.me/?text=')).toBe(true);
  expect(u).toContain(encodeURIComponent('ciao & a presto'));
});

import { buildInviteMessage, whatsappUrl } from './invite';

test('il messaggio contiene il nickname e il nome dell\'app', () => {
  const m = buildInviteMessage('Mario_88', null);
  expect(m).toContain('Mario_88');
  expect(m).toContain('MotoAmici');
});
test('con il link lo include; senza link non scrive mai «null» o «undefined»', () => {
  expect(buildInviteMessage('mario', 'https://esempio.it/app')).toContain('https://esempio.it/app');
  const senza = buildInviteMessage('mario', null);
  expect(senza).not.toMatch(/null|undefined/);
});
test('whatsappUrl codifica il testo (spazi, accenti, a capo)', () => {
  const u = whatsappUrl('Ciao! È un test\nriga due');
  expect(u.startsWith('https://wa.me/?text=')).toBe(true);
  expect(u).not.toMatch(/\s/);
  expect(decodeURIComponent(u.split('text=')[1])).toBe('Ciao! È un test\nriga due');
});

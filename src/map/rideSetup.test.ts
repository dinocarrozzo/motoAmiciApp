import { validateRideSetup } from './rideSetup';

test('tipo obbligatorio', () => {
  const r = validateRideSetup({ rideType: null, visibility: 'all', destination: '' });
  expect(r.ok).toBe(false);
  expect(r.errors.rideType).toBeDefined();
});
test('destinazione troppo lunga', () => {
  const r = validateRideSetup({ rideType: 'enduro', visibility: 'all', destination: 'a'.repeat(81) });
  expect(r.ok).toBe(false);
  expect(r.errors.destination).toBeDefined();
});
test('spazi → null', () => {
  const r = validateRideSetup({ rideType: 'enduro', visibility: 'friends', destination: '  ' });
  expect(r.value).toEqual({ rideType: 'enduro', visibility: 'friends', destination: null });
});
test('valido', () => {
  const r = validateRideSetup({ rideType: 'passeggiata', visibility: 'all', destination: ' Lago ' });
  expect(r.ok).toBe(true);
  expect(r.value?.destination).toBe('Lago');
});

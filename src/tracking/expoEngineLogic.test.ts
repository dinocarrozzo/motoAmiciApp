import { statusFromPermissions, toLibLocation } from './expoEngineLogic';

test('statusFromPermissions: sempre → 3, solo in uso → 4, niente → 2', () => {
  expect(statusFromPermissions(true, true)).toBe(3);
  expect(statusFromPermissions(true, false)).toBe(4);
  expect(statusFromPermissions(false, false)).toBe(2);
  expect(statusFromPermissions(false, true)).toBe(2); // sempre senza base non ha senso
});

test('toLibLocation converte una posizione di expo-location nel formato del tracker', () => {
  const input = {
    timestamp: 1_700_000_000_000,
    coords: { latitude: 44.5, longitude: 11.3, accuracy: 6, speed: 12.5, altitude: 1, heading: 0, altitudeAccuracy: 1 },
  };
  const out = toLibLocation(input);
  expect(out).toEqual({
    timestamp: 1_700_000_000_000,
    coords: { latitude: 44.5, longitude: 11.3, accuracy: 6, speed: 12.5 },
  });
});

test('toLibLocation lascia a null accuracy e speed quando mancano', () => {
  const input = {
    timestamp: 5,
    coords: { latitude: 1, longitude: 2, accuracy: null, speed: null, altitude: null, heading: null, altitudeAccuracy: null },
  };
  const out = toLibLocation(input);
  expect(out.coords.accuracy).toBeNull();
  expect(out.coords.speed).toBeNull();
});

import { TRACKING_PROFILE } from './expoEngineLogic';

test('profilo di tracciamento scelto: precisione alta, un punto ogni 10 s, filtro a 10 m', () => {
  expect(TRACKING_PROFILE).toEqual({ accuracy: 'High', timeIntervalMs: 10_000, distanceIntervalM: 10 });
});

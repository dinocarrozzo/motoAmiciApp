import type { TrackPoint } from './types';

test('un TrackPoint accetta accuracy e speed nulli', () => {
  const p: TrackPoint = {
    sessionId: 's1',
    recordedAt: 1_700_000_000_000,
    lat: 44.5,
    lng: 11.3,
    accuracy: null,
    speed: null,
  };
  expect(p.accuracy).toBeNull();
  expect(p.speed).toBeNull();
});

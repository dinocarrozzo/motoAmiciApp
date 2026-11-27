import type { RideSettings, RideType, Visibility } from './types';

export type RideSetupForm = { rideType: RideType | null; visibility: Visibility; destination: string };

export function validateRideSetup(f: RideSetupForm): {
  ok: boolean;
  errors: { rideType?: string; destination?: string };
  value?: RideSettings;
} {
  const errors: { rideType?: string; destination?: string } = {};
  const dest = f.destination.trim();
  if (!f.rideType) errors.rideType = 'Scegli il tipo di uscita';
  if (dest.length > 80) errors.destination = 'Massimo 80 caratteri';
  if (errors.rideType || errors.destination || !f.rideType) return { ok: false, errors };
  return {
    ok: true,
    errors,
    value: { rideType: f.rideType, visibility: f.visibility, destination: dest === '' ? null : dest },
  };
}

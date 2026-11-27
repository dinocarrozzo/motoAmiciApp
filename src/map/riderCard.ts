import type { BikeType, Gender } from '../profile/types';
import type { Rider, RideType } from './types';

const COLORS: Record<Gender, string> = { m: '#0ea5e9', f: '#ec4899', x: '#8b5cf6' };
export const markerColor = (g: Gender): string => COLORS[g] ?? COLORS.x;

const RIDE_LABEL: Record<RideType, string> = {
  passeggiata: 'Passeggiata',
  'passeggiata-veloce': 'Passeggiata veloce',
  enduro: 'Enduro',
};
const BIKE_LABEL: Record<BikeType, string> = {
  'stradale-sportiva': 'Stradale sportiva',
  custom: 'Custom',
  naked: 'Naked',
  enduro: 'Enduro',
  maxienduro: 'Maxienduro',
};
export const rideTypeLabel = (t: RideType): string => RIDE_LABEL[t];

function age(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `Aggiornato ${s} s fa` : `Aggiornato ${Math.floor(s / 60)} min fa`;
}

export function describeRider(r: Rider, now: number) {
  const lines: string[] = [];
  if (!r.exact) lines.push('Posizione approssimata (circa 500 m)');
  lines.push(age(now - r.recordedAt));
  if (r.rideType) lines.push(`Uscita: ${RIDE_LABEL[r.rideType]}`);
  if (r.bikeType) lines.push(`Moto: ${BIKE_LABEL[r.bikeType]}`);
  if (r.destination) lines.push(`Destinazione: ${r.destination}`);
  return {
    title: r.nickname,
    subtitle: null as string | null,
    lines,
    premiumHint: r.rideType === null,
    friendTag: r.isFriend,
  };
}

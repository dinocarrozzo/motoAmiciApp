import type { BikeType, Gender } from '../profile/types';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const REFRESH_RIDERS_MS = 10_000;

export type RideType = 'passeggiata' | 'passeggiata-veloce' | 'enduro';
export type Visibility = 'all' | 'friends';

export type BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export type Rider = {
  id: string;
  nickname: string;
  avatar: string;
  gender: Gender;
  lat: number;
  lng: number;
  exact: boolean;
  isFriend: boolean;
  recordedAt: number;
  rideType: RideType | null;
  bikeType: BikeType | null;
  destination: string | null;
};

export type RideSettings = {
  rideType: RideType;
  visibility: Visibility;
  destination: string | null;
};

/** Vista iniziale: circa 100 km di raggio attorno a te (zoom 7); senza posizione, l'Italia intera. */
export const START_ZOOM = 7;
export const RECENTER_ZOOM = 11;
export const FALLBACK_VIEW = { center: [12.5, 42.0] as [number, number], zoom: 5 };
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 17;

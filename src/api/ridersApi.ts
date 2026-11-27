import { clampBox } from '../map/bbox';
import type { BBox, RideSettings, Rider } from '../map/types';
import type { RpcClient } from './friendsApi';

const toRider = (r: any): Rider => ({
  id: r.id,
  nickname: r.nickname,
  avatar: r.avatar,
  gender: r.gender,
  lat: r.lat,
  lng: r.lng,
  exact: !!r.exact,
  isFriend: !!r.is_friend,
  recordedAt: Date.parse(r.recorded_at),
  rideType: r.ride_type ?? null,
  bikeType: r.bike_type ?? null,
  destination: r.destination ?? null,
});

export function createRidersApi(client: RpcClient) {
  async function call(fn: string, args: Record<string, unknown>): Promise<any[]> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  }
  return {
    async startRide(id: string, s: RideSettings): Promise<void> {
      await call('start_ride', {
        p_ride_id: id,
        p_ride_type: s.rideType,
        p_visibility: s.visibility,
        p_destination: s.destination,
      });
    },
    async endRide(id: string): Promise<void> {
      await call('end_ride', { p_ride_id: id });
    },
    async inArea(box: BBox): Promise<Rider[]> {
      const b = clampBox(box);
      const rows = await call('riders_in_area', {
        min_lat: b.minLat, min_lng: b.minLng, max_lat: b.maxLat, max_lng: b.maxLng,
      });
      return rows.map(toRider);
    },
  };
}

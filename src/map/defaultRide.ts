import { getRidersApi } from '../api';
import { tracker } from '../tracking/defaultTracker';
import { createRideController } from './rideController';

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const rideController = createRideController({
  api: {
    startRide: (id, s, groupId) => getRidersApi().startRide(id, s, groupId),
    endRide: (id) => getRidersApi().endRide(id),
  },
  tracker,
  newId: uuidv4,
});

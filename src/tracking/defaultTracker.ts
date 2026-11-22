import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { ensureSignedIn, sendPoints } from '../api/trackApi';
import { PointBuffer } from './pointBuffer';
import { createTracker, type GeoLib } from './tracker';

export const stats = { sent: 0, lastSentAt: null as number | null, lastError: null as string | null };

const lib: GeoLib = {
  ready: (config) => BackgroundGeolocation.ready(config as any),
  start: () => BackgroundGeolocation.start(),
  stop: () => BackgroundGeolocation.stop(),
  requestPermission: () => BackgroundGeolocation.requestPermission(),
  onLocation: (cb) => BackgroundGeolocation.onLocation(cb),
};

export const buffer = new PointBuffer({
  store: AsyncStorage,
  send: async (points) => {
    try {
      await sendPoints(points);
      stats.sent += points.length;
      stats.lastSentAt = Date.now();
      stats.lastError = null;
    } catch (e) {
      stats.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  },
});

export const tracker = createTracker({ lib, buffer, ensureSignedIn });

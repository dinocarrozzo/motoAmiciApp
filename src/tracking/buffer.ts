import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPoints } from '../api/trackApi';
import { PointBuffer } from './pointBuffer';

export const stats = { sent: 0, lastSentAt: null as number | null, lastError: null as string | null };

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

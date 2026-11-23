import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPoints } from '../api/trackApi';
import { PointBuffer } from './pointBuffer';
import { recordError, recordSent, stats } from './stats';

export { stats };

export const buffer = new PointBuffer({
  store: AsyncStorage,
  send: async (points) => {
    try {
      await sendPoints(points);
      recordSent(points.length);
    } catch (e) {
      recordError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSignedIn } from '../api/trackApi';
import { buffer, stats } from './buffer';
import { defineExpoTask, expoGeoLib } from './expoEngine';
import { createTracker } from './tracker';

export { buffer, stats };

export const tracker = createTracker({
  lib: expoGeoLib,
  buffer,
  store: AsyncStorage,
  ensureSignedIn,
});

/** Da chiamare una volta all'avvio (index.ts), prima di registrare il componente radice. */
export function registerBackground(): void {
  defineExpoTask();
}

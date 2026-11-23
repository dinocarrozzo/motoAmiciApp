import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSignedIn } from '../api/trackApi';
import { buffer, stats } from './buffer';
import { defineExpoTask, expoGeoLib } from './expoEngine';
import { createHeadlessHandler, createTracker, type GeoLib } from './tracker';

export { buffer, stats };

/** "expo" (gratuito, predefinito) oppure "transistorsoft" (a pagamento, richiede licenza). */
export const ENGINE: 'expo' | 'transistorsoft' =
  process.env.EXPO_PUBLIC_GPS_ENGINE === 'transistorsoft' ? 'transistorsoft' : 'expo';

function transistorsoft() {
  // Caricata solo se serve, così il motore gratuito non tocca la libreria a pagamento.
  return require('react-native-background-geolocation').default;
}

function transistorLib(): GeoLib {
  const BG = transistorsoft();
  return {
    ready: (config) => BG.ready(config as any),
    start: () => BG.start(),
    stop: () => BG.stop(),
    requestPermission: () => BG.requestPermission(),
    isEnabled: async () => (await BG.getState()).enabled,
    onLocation: (cb) => BG.onLocation(cb),
  };
}

export const tracker = createTracker({
  lib: ENGINE === 'expo' ? expoGeoLib : transistorLib(),
  buffer,
  store: AsyncStorage,
  ensureSignedIn,
});

/** Da chiamare una volta all'avvio (index.ts), prima di registrare il componente radice. */
export function registerBackground(): void {
  if (ENGINE === 'expo') {
    defineExpoTask();
  } else {
    const handler = createHeadlessHandler({ buffer, store: AsyncStorage });
    transistorsoft().registerHeadlessTask(handler);
  }
}

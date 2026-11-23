import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { buffer } from './buffer';
import { statusFromPermissions, toLibLocation, TRACKING_PROFILE } from './expoEngineLogic';
import { createHeadlessHandler, type GeoLib } from './tracker';

export const TASK_NAME = 'motoamici-location';

const handleEvent = createHeadlessHandler({ buffer, store: AsyncStorage });

/**
 * Da chiamare una volta, nello scope globale (index.ts): il sistema richiama questo compito
 * anche quando l'app è chiusa, e ogni posizione va nel buffer con la sessione salvata.
 */
export function defineExpoTask(): void {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
    if (error || !data?.locations) return;
    for (const l of data.locations as Location.LocationObject[]) {
      await handleEvent({ name: 'location', params: toLibLocation(l) });
    }
  });
}

export const expoGeoLib: GeoLib = {
  ready: async () => undefined,
  start: () =>
    Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy[TRACKING_PROFILE.accuracy],
      distanceInterval: TRACKING_PROFILE.distanceIntervalM,
      timeInterval: TRACKING_PROFILE.timeIntervalMs,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'MotoAmici',
        notificationBody: 'MotoAmici sta tracciando il giro',
        killServiceOnDestroy: false,
      },
    }),
  stop: async () => {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  },
  requestPermission: async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return statusFromPermissions(false, false);
    const bg = await Location.requestBackgroundPermissionsAsync();
    return statusFromPermissions(true, bg.granted);
  },
  isEnabled: () => Location.hasStartedLocationUpdatesAsync(TASK_NAME),
  // Le posizioni arrivano dal compito in background, non da un ascoltatore dell'interfaccia.
  onLocation: () => ({ remove: () => undefined }),
};

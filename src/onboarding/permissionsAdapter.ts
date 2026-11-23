import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import type { Grants, StepId } from './flow';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const BACKGROUND = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
const NOTIFICATIONS = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

const PACKAGE = 'it.motoamici.prototype';
// Android non dice se l'app è esclusa dal risparmio batteria: ricordiamo che l'utente è passato dalla finestra.
const BATTERY_ASKED_KEY = 'motoamici.batteryAsked';

// Su Android prima della 13 le notifiche non richiedono permesso.
const needsNotificationPermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function checkAll(): Promise<Grants> {
  return {
    'location-foreground': await PermissionsAndroid.check(FINE),
    'location-background': await PermissionsAndroid.check(BACKGROUND),
    notifications: needsNotificationPermission() ? await PermissionsAndroid.check(NOTIFICATIONS) : true,
    battery: (await AsyncStorage.getItem(BATTERY_ASKED_KEY).catch(() => null)) === '1',
  };
}

/** Mostra la finestra o la pagina di sistema specifica del permesso. */
export async function request(id: StepId): Promise<void> {
  switch (id) {
    case 'location-foreground':
      await PermissionsAndroid.requestMultiple([FINE, COARSE]);
      return;
    case 'location-background':
      // Da Android 11 apre la pagina Posizione dell'app invece di una finestra.
      await PermissionsAndroid.request(BACKGROUND);
      return;
    case 'notifications':
      if (needsNotificationPermission()) await PermissionsAndroid.request(NOTIFICATIONS);
      return;
    case 'battery': {
      try {
        // Finestra di sistema: «Consentire all'app di funzionare sempre in background?»
        await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
          data: `package:${PACKAGE}`,
        });
      } catch {
        // Su alcuni telefoni la finestra diretta non esiste: si apre l'elenco delle app.
        await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      }
      await AsyncStorage.setItem(BATTERY_ASKED_KEY, '1');
      return;
    }
  }
}

export const openAppSettings = (): Promise<void> => Linking.openSettings();

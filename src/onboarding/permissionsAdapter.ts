import { Linking, PermissionsAndroid, Platform } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import type { Grants, StepId } from './flow';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const BACKGROUND = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
const NOTIFICATIONS = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

// Su Android prima della 13 le notifiche non richiedono permesso.
const needsNotificationPermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function checkAll(): Promise<Grants> {
  const ds = BackgroundGeolocation.deviceSettings;
  return {
    'location-foreground': await PermissionsAndroid.check(FINE),
    'location-background': await PermissionsAndroid.check(BACKGROUND),
    notifications: needsNotificationPermission() ? await PermissionsAndroid.check(NOTIFICATIONS) : true,
    battery: await ds.isIgnoringBatteryOptimizations(),
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
      const ds = BackgroundGeolocation.deviceSettings;
      const req = await ds.showIgnoreBatteryOptimizations();
      await ds.show(req);
      return;
    }
  }
}

export const openAppSettings = (): Promise<void> => Linking.openSettings();

import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackground } from './src/tracking/defaultTracker';

// Serve a continuare a registrare e inviare i punti se il sistema chiude l'app.
registerBackground();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

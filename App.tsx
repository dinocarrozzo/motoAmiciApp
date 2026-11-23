import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BatterySetupScreen } from './src/screens/BatterySetupScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { TrackScreen } from './src/screens/TrackScreen';

const SETUP_DONE_KEY = 'motoamici.setupDone';
type Stage = 'loading' | 'permissions' | 'battery-guide' | 'track';

export default function App() {
  const [stage, setStage] = useState<Stage>('loading');

  useEffect(() => {
    AsyncStorage.getItem(SETUP_DONE_KEY)
      .then((v) => setStage(v === '1' ? 'track' : 'permissions'))
      .catch(() => setStage('permissions'));
  }, []);

  const finishSetup = () => {
    AsyncStorage.setItem(SETUP_DONE_KEY, '1').catch(() => undefined);
    setStage('track');
  };

  return (
    <>
      {stage === 'permissions' && <OnboardingScreen onDone={() => setStage('battery-guide')} />}
      {stage === 'battery-guide' && <BatterySetupScreen onDone={finishSetup} />}
      {stage === 'track' && <TrackScreen />}
      <StatusBar style="auto" />
    </>
  );
}

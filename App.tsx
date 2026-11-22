import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { BatterySetupScreen } from './src/screens/BatterySetupScreen';
import { TrackScreen } from './src/screens/TrackScreen';

export default function App() {
  const [batteryDone, setBatteryDone] = useState(false);
  return (
    <>
      {batteryDone ? <TrackScreen /> : <BatterySetupScreen onDone={() => setBatteryDone(true)} />}
      <StatusBar style="auto" />
    </>
  );
}

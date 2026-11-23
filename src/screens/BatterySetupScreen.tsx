import * as Device from 'expo-device';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { batteryInstructions } from '../battery/batteryInstructions';

export function BatterySetupScreen({ onDone }: { onDone: () => void }) {
  const { title, steps } = batteryInstructions(Device.manufacturer ?? '');
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.intro}>
        Senza questi passaggi il telefono può fermare il GPS a schermo bloccato e sparirai dalla mappa.
      </Text>
      {steps.map((s, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.num}>{i + 1}.</Text>
          <Text style={styles.step}>{s}</Text>
        </View>
      ))}
      <TouchableOpacity
        style={styles.secondary}
        onPress={async () => {
          try {
            const ds = require('react-native-background-geolocation').default.deviceSettings;
            await ds.show(await ds.showPowerManager());
          } catch {
            Linking.openSettings();
          }
        }}
      >
        <Text style={styles.secondaryText}>Apri la gestione energia del telefono</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => Linking.openSettings()}>
        <Text style={styles.secondaryText}>Apri le impostazioni dell'app</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primary} onPress={onDone}>
        <Text style={styles.primaryText}>Ho fatto, continua</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  intro: { fontSize: 15, color: '#444' },
  row: { flexDirection: 'row', gap: 8 },
  num: { fontWeight: '700' },
  step: { flex: 1, fontSize: 16 },
  secondary: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#888', alignItems: 'center' },
  secondaryText: { fontSize: 16 },
  primary: { padding: 14, borderRadius: 8, backgroundColor: '#1d4ed8', alignItems: 'center' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

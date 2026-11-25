import { Text, TouchableOpacity, View } from 'react-native';
import type { BikeType, Gender } from '../../profile/types';
import { colors, styles } from '../ui';

export const GENDERS: { id: Gender; label: string }[] = [
  { id: 'm', label: 'Uomo' },
  { id: 'f', label: 'Donna' },
  { id: 'x', label: 'Preferisco non dirlo' },
];
export const BIKES: { id: BikeType; label: string }[] = [
  { id: 'stradale-sportiva', label: 'Stradale sportiva' },
  { id: 'custom', label: 'Custom' },
  { id: 'naked', label: 'Naked' },
  { id: 'enduro', label: 'Enduro' },
  { id: 'maxienduro', label: 'Maxi enduro' },
];

export function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 16, color: selected ? colors.primary : '#111' }}>{selected ? '◉ ' : '○ '}{label}</Text>
    </TouchableOpacity>
  );
}

/** Sesso e tipo di moto: nessuna scelta preimpostata, vanno indicati per proseguire. */
export function GenderAndBike({ gender, bikeType, onGender, onBike, errors }: {
  gender: Gender | null;
  bikeType: BikeType | null;
  onGender: (g: Gender) => void;
  onBike: (b: BikeType) => void;
  errors: { gender?: string; bikeType?: string };
}) {
  return (
    <View>
      <Text style={styles.label}>Sesso (decide il colore del tuo segnaposto) *</Text>
      {GENDERS.map((g) => <Choice key={g.id} selected={gender === g.id} label={g.label} onPress={() => onGender(g.id)} />)}
      {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}
      <View style={{ height: 10 }} />
      <Text style={styles.label}>Che moto hai? *</Text>
      {BIKES.map((b) => <Choice key={b.id} selected={bikeType === b.id} label={b.label} onPress={() => onBike(b.id)} />)}
      {errors.bikeType ? <Text style={styles.error}>{errors.bikeType}</Text> : null}
    </View>
  );
}

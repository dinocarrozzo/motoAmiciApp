import { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { validateRideSetup } from '../../map/rideSetup';
import type { RideSettings, RideType, Visibility } from '../../map/types';
import { Choice } from '../profile/ProfileChoices';
import { Button, Field, styles } from '../ui';

const TYPES: { id: RideType; label: string }[] = [
  { id: 'passeggiata', label: 'Passeggiata' },
  { id: 'passeggiata-veloce', label: 'Passeggiata veloce' },
  { id: 'enduro', label: 'Enduro' },
];

export function RideSetupSheet({ visible, busy, onCancel, onConfirm }: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (s: RideSettings) => void;
}) {
  const [rideType, setRideType] = useState<RideType | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [destination, setDestination] = useState('');
  const [errors, setErrors] = useState<{ rideType?: string; destination?: string }>({});

  const confirm = () => {
    const r = validateRideSetup({ rideType, visibility, destination });
    setErrors(r.errors);
    if (r.ok && r.value) onConfirm(r.value);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50, gap: 8 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Parti per un giro</Text>
        <Text style={styles.label}>Che uscita fai? *</Text>
        {TYPES.map((t) => <Choice key={t.id} selected={rideType === t.id} label={t.label} onPress={() => setRideType(t.id)} />)}
        {errors.rideType ? <Text style={styles.error}>{errors.rideType}</Text> : null}
        <View style={{ height: 8 }} />
        <Text style={styles.label}>Chi ti vede sulla mappa?</Text>
        <Choice selected={visibility === 'all'} label="Tutti i motociclisti dell'app" onPress={() => setVisibility('all')} />
        <Choice selected={visibility === 'friends'} label="Solo i miei amici" onPress={() => setVisibility('friends')} />
        <Text style={{ color: '#555', fontSize: 13 }}>
          Chi non è tuo amico ti vede in posizione approssimata (circa 500 m). Gli utenti bloccati non ti vedono mai.
        </Text>
        <Field label="Destinazione (facoltativa)" value={destination} onChangeText={setDestination} placeholder="Es. Lago di Como" error={errors.destination} />
        <Button title="Parti e condividi la posizione" onPress={confirm} busy={busy} />
        <TouchableOpacity onPress={onCancel} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#475569', fontSize: 16 }}>Annulla</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

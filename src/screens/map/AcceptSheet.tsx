import { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity } from 'react-native';
import type { IncomingRequest, MeetPoint } from '../../groups/types';
import { Choice } from '../profile/ProfileChoices';
import { Button, Field, Notice } from '../ui';

export type MeetChoice = 'none' | 'here' | 'map';

/** Risposta «Accetta»: punto d'incontro (nessuno / la mia posizione / scelto sulla mappa) e nota. */
export function AcceptSheet({ request, picked, busy, error, onCancel, onPickOnMap, onConfirm }: {
  request: IncomingRequest | null;
  picked: MeetPoint;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onPickOnMap: () => void;
  onConfirm: (choice: MeetChoice, note: string | null) => void;
}) {
  const [choice, setChoice] = useState<MeetChoice>('none');
  const [note, setNote] = useState('');
  const effective: MeetChoice = choice;

  return (
    <Modal visible={request !== null} animationType="slide" onRequestClose={onCancel}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, gap: 8 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Accetta {request?.nickname}</Text>
        <Text style={{ color: '#555' }}>Dove ci si incontra? (facoltativo)</Text>
        <Choice selected={effective === 'none'} label="Nessun punto" onPress={() => setChoice('none')} />
        <Choice selected={effective === 'here'} label="La mia posizione attuale" onPress={() => setChoice('here')} />
        <Choice
          selected={effective === 'map'}
          label={picked ? 'Punto scelto sulla mappa ✓ (tocca per cambiarlo)' : 'Scegli sulla mappa'}
          onPress={() => { setChoice('map'); onPickOnMap(); }}
        />
        <Field label="Nota (facoltativa)" value={note} onChangeText={setNote} maxLength={140} placeholder="Es. Bar Sport, ore 10" />
        {error ? <Notice text={error} /> : null}
        <Button title="Accetta" onPress={() => onConfirm(effective, note.trim() || null)} busy={busy} />
        <TouchableOpacity onPress={onCancel} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#475569', fontSize: 16 }}>Annulla</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

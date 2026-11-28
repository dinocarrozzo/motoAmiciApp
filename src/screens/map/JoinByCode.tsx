import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { getGroupsApi } from '../../api';
import { normalizeInviteCode } from '../../groups/inviteCode';
import { Button, Field, Notice, SheetScroll } from '../ui';

export function JoinByCode({ visible, onClose, onJoined }: { visible: boolean; onClose: () => void; onJoined: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    const code = normalizeInviteCode(text);
    if (!code) {
      setError('Il codice è di 6 caratteri (lettere e numeri), come nel messaggio che hai ricevuto.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getGroupsApi().joinByCode(code);
      setText('');
      onJoined();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SheetScroll>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Entra con un codice</Text>
        <Text style={{ color: '#555' }}>Scrivi il codice che ti ha mandato chi guida il giro.</Text>
        <Field label="Codice del gruppo" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} placeholder="Es. K7M2QX" />
        {error ? <Notice text={error} /> : null}
        <Button title="Entra nel gruppo" onPress={join} busy={busy} />
        <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#475569', fontSize: 16 }}>Annulla</Text>
        </TouchableOpacity>
      </SheetScroll>
    </Modal>
  );
}

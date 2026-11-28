import { useEffect, useState } from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getFriendsApi, getGroupsApi } from '../../api';
import { buildGroupInviteMessage, groupInviteWhatsappUrl } from '../../groups/inviteMessage';
import type { MyGroup, Participant } from '../../groups/types';
import type { ProfileSummary } from '../../profile/types';
import { Button, Notice } from '../ui';

/** Il mio gruppo durante il giro: partecipanti, codice, inviti. */
export function GroupPanel({ group, nickname, onChanged }: { group: MyGroup; nickname: string; onChanged: () => void }) {
  const [people, setPeople] = useState<Participant[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGroupsApi().participants(group.groupId).then(
      (p) => { if (!cancelled) setPeople(p); },
      () => undefined,
    );
    return () => { cancelled = true; };
  }, [group.groupId, group.memberCount]);

  const whatsapp = () => {
    const msg = buildGroupInviteMessage({ nickname, destination: group.destination, code: group.inviteCode });
    Linking.openURL(groupInviteWhatsappUrl(msg)).catch(() => undefined);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '700' }}>
        Il tuo gruppo: {group.memberCount} {group.memberCount === 1 ? 'persona' : 'persone'} · codice {group.inviteCode}
      </Text>
      {people.length > 0 ? (
        <Text style={{ color: '#334155' }} numberOfLines={2}>
          {people.map((p) => `${p.nickname}${p.role === 'owner' ? ' (guida)' : ''}`).join(', ')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Invita su WhatsApp" variant="secondary" onPress={whatsapp} /></View>
        <View style={{ flex: 1 }}><Button title="Invita un amico" variant="secondary" onPress={() => setFriendsOpen(true)} /></View>
      </View>
      <InviteFriendSheet visible={friendsOpen} groupId={group.groupId} onClose={() => setFriendsOpen(false)} onInvited={onChanged} />
    </View>
  );
}

function InviteFriendSheet({ visible, groupId, onClose, onInvited }: { visible: boolean; groupId: string; onClose: () => void; onInvited: () => void }) {
  const [friends, setFriends] = useState<ProfileSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    getFriendsApi().list().then((l) => setFriends(l.friends), (e) => setError(e instanceof Error ? e.message : String(e)));
  }, [visible]);

  const invite = async (f: ProfileSummary) => {
    try {
      await getGroupsApi().inviteFriend(groupId, f.id);
      setSent((s) => [...s, f.id]);
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Invita un amico</Text>
        {error ? <Notice text={error} /> : null}
        {friends.length === 0 ? <Text style={{ color: '#555' }}>Non hai ancora amici nell'app.</Text> : null}
        {friends.map((f) => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16 }}>{f.nickname}</Text>
            {sent.includes(f.id) ? <Text style={{ color: '#15803d' }}>Invitato ✓</Text> : (
              <TouchableOpacity onPress={() => invite(f)}><Text style={{ color: '#1d4ed8', fontSize: 16 }}>Invita</Text></TouchableOpacity>
            )}
          </View>
        ))}
        <Button title="Chiudi" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

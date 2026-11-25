import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getFriendsApi } from '../../api';
import { relationshipWith } from '../../friends/relationship';
import { APP_DOWNLOAD_LINK, buildInviteMessage, whatsappUrl } from '../../friends/invite';
import type { Block, Friendship, ProfileSummary } from '../../profile/types';
import { Button, colors, Notice, styles } from '../ui';
import { PersonRow } from './PersonRow';
import { SearchBar } from './SearchBar';
import { SmallButton } from './SmallButton';

type Lists = { friends: ProfileSummary[]; received: ProfileSummary[]; sent: ProfileSummary[]; blocked: ProfileSummary[] };
type Section = 'friends' | 'requests' | 'blocked';

export function FriendsScreen({ myId, myNickname }: { myId: string; myNickname: string }) {
  const [lists, setLists] = useState<Lists>({ friends: [], received: [], sent: [], blocked: [] });
  const [section, setSection] = useState<Section>('friends');
  const [suggestions, setSuggestions] = useState<ProfileSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const api = getFriendsApi();
      const [l, blocked] = await Promise.all([api.list(), api.listBlocked()]);
      setLists({ ...l, blocked });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  // Per mostrare lo stato giusto accanto a ogni suggerimento.
  const { friendships, blocks } = useMemo(() => {
    const f: Friendship[] = [
      ...lists.friends.map((p) => ({ requester: myId, addressee: p.id, status: 'accepted' as const })),
      ...lists.sent.map((p) => ({ requester: myId, addressee: p.id, status: 'pending' as const })),
      ...lists.received.map((p) => ({ requester: p.id, addressee: myId, status: 'pending' as const })),
    ];
    const b: Block[] = lists.blocked.map((p) => ({ blocker: myId, blocked: p.id }));
    return { friendships: f, blocks: b };
  }, [lists, myId]);

  const act = async (id: string, fn: () => Promise<void>) => {
    if (busyId) return; // niente doppio tocco
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmBlock = (p: ProfileSummary) =>
    Alert.alert(
      `Bloccare ${p.nickname}?`,
      "Non ti vedrà più e non potrà cercarti. Se eravate amici, l'amicizia viene cancellata. Non riceverà nessuna notifica.",
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Blocca', style: 'destructive', onPress: () => act(p.id, () => getFriendsApi().block(p.id)) },
      ],
    );

  const api = getFriendsApi;
  const SuggestionAction = ({ p }: { p: ProfileSummary }) => {
    const rel = relationshipWith(myId, p.id, friendships, blocks);
    const disabled = busyId === p.id;
    if (rel === 'friends') return <Text style={{ color: colors.ok, fontWeight: '700' }}>Amici ✓</Text>;
    if (rel === 'request-sent') return <Text style={{ color: colors.muted }}>Richiesta inviata</Text>;
    if (rel === 'request-received') return <SmallButton title="Accetta" disabled={disabled} onPress={() => act(p.id, () => api().respond(p.id, true))} />;
    if (rel === 'blocked-by-me') return <SmallButton title="Sblocca" kind="ghost" disabled={disabled} onPress={() => act(p.id, () => api().unblock(p.id))} />;
    return <SmallButton title="Aggiungi" disabled={disabled} onPress={() => act(p.id, () => api().sendRequest(p.id))} />;
  };

  const invite = async () => {
    try {
      await Linking.openURL(whatsappUrl(buildInviteMessage(myNickname, APP_DOWNLOAD_LINK)));
    } catch {
      setError('Non riesco ad aprire WhatsApp. È installato?');
    }
  };

  const tabs: { id: Section; label: string; n: number }[] = [
    { id: 'friends', label: 'Amici', n: lists.friends.length },
    { id: 'requests', label: 'Richieste', n: lists.received.length },
    { id: 'blocked', label: 'Bloccati', n: lists.blocked.length },
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Amici</Text>
      {error ? <Notice text={error} /> : null}
      <SearchBar onResults={setSuggestions} onActive={setSearching} />
      {searching ? (
        <View>
          {suggestions.map((p) => (
            <PersonRow key={p.id} person={p}><SuggestionAction p={p} /></PersonRow>
          ))}
          {suggestions.length === 0 ? <Text style={{ color: colors.muted, paddingVertical: 10 }}>Nessun risultato (ancora).</Text> : null}
        </View>
      ) : (
        <View>
          <Button title="Invita un amico su WhatsApp" onPress={invite} variant="secondary" />
          <View style={{ flexDirection: 'row', marginVertical: 10 }}>
            {tabs.map((t) => (
              <TouchableOpacity key={t.id} onPress={() => setSection(t.id)} style={{ flex: 1, padding: 8, alignItems: 'center', borderBottomWidth: 3, borderColor: section === t.id ? colors.primary : 'transparent' }}>
                <Text style={{ fontWeight: section === t.id ? '700' : '400' }}>{t.label}{t.n ? ` (${t.n})` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {section === 'friends' && (
            <View>
              {lists.friends.map((p) => (
                <PersonRow key={p.id} person={p}>
                  <SmallButton title="Rimuovi" kind="ghost" disabled={busyId === p.id} onPress={() => act(p.id, () => api().remove(p.id))} />
                  <SmallButton title="Blocca" kind="danger" disabled={busyId === p.id} onPress={() => confirmBlock(p)} />
                </PersonRow>
              ))}
              {lists.friends.length === 0 ? <Text style={{ color: colors.muted }}>Non hai ancora amici: cercane uno qui sopra o invita qualcuno su WhatsApp.</Text> : null}
            </View>
          )}
          {section === 'requests' && (
            <View>
              {lists.received.map((p) => (
                <PersonRow key={p.id} person={p}>
                  <SmallButton title="Accetta" disabled={busyId === p.id} onPress={() => act(p.id, () => api().respond(p.id, true))} />
                  <SmallButton title="Rifiuta" kind="ghost" disabled={busyId === p.id} onPress={() => act(p.id, () => api().respond(p.id, false))} />
                  <SmallButton title="Blocca" kind="danger" disabled={busyId === p.id} onPress={() => confirmBlock(p)} />
                </PersonRow>
              ))}
              {lists.received.length === 0 ? <Text style={{ color: colors.muted }}>Nessuna richiesta ricevuta.</Text> : null}
              {lists.sent.length > 0 ? <Text style={[styles.label, { marginTop: 16 }]}>Richieste inviate</Text> : null}
              {lists.sent.map((p) => (
                <PersonRow key={p.id} person={p}>
                  <Text style={{ color: colors.muted }}>In attesa</Text>
                </PersonRow>
              ))}
            </View>
          )}
          {section === 'blocked' && (
            <View>
              {lists.blocked.map((p) => (
                <PersonRow key={p.id} person={p}>
                  <SmallButton title="Sblocca" kind="ghost" disabled={busyId === p.id} onPress={() => act(p.id, () => api().unblock(p.id))} />
                </PersonRow>
              ))}
              {lists.blocked.length === 0 ? <Text style={{ color: colors.muted }}>Non hai bloccato nessuno.</Text> : null}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

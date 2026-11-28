import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getGroupsApi, getRidersApi } from '../../api';
import { createRefreshLoop } from '../../friends/refreshLoop';
import { isMeetPointFresh } from '../../groups/meetPoint';
import type { IncomingRequest, MeetPoint } from '../../groups/types';
import { createGroupState, fetchAllGroupState, type GroupSnapshot } from '../../groups/useGroupState';
import { bboxCenter } from '../../map/bbox';
import { sameRiders } from '../../map/geojson';
import { createRidersFeed } from '../../map/useRiders';
import { REFRESH_RIDERS_MS, type BBox, type Rider } from '../../map/types';
import { useKeyboardHeight } from '../useKeyboardHeight';
import { AcceptSheet, type MeetChoice } from './AcceptSheet';
import { Button } from '../ui';
import { MapLegend } from './MapLegend';
import { RiderCard } from './RiderCard';
import { RidersMap } from './RidersMap';
import { TrackPanel } from './TrackPanel';

type LngLat = [number, number];

/** Posizione del telefono: l'ultima nota, altrimenti una lettura veloce (max 4 s). Null se non c'è permesso o posizione. */
async function findMe(): Promise<LngLat | null> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (!p.granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    if (last) return [last.coords.longitude, last.coords.latitude];
    const now = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((res) => setTimeout(() => res(null), 4000)),
    ]);
    return now ? [now.coords.longitude, now.coords.latitude] : null;
  } catch {
    return null;
  }
}

/** Mappa a schermo intero: vedi gli altri senza dover condividere la tua posizione. */
const EMPTY: GroupSnapshot = { group: null, incoming: [], mine: [], invites: [] };

export function MapScreen({ active, nickname }: { active: boolean; nickname: string }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // la mappa si apre solo dopo aver cercato la tua posizione
  const [start, setStart] = useState<LngLat | null>(null);
  const [showUser, setShowUser] = useState(false);
  const [recenter, setRecenter] = useState<{ at: LngLat; n: number } | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const looked = useRef(false);
  const kb = useKeyboardHeight();
  const lastBox = useRef<BBox | null>(null);
  const [snapshot, setSnapshot] = useState<GroupSnapshot>(EMPTY);
  const [accepting, setAccepting] = useState<IncomingRequest | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<MeetPoint>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const feed = useMemo(
    () =>
      createRidersFeed({
        fetch: (box) => getRidersApi().inArea(box),
        onRiders: (r) => {
          setRiders((old) => (sameRiders(old, r) ? old : r));
          setError(null);
        },
        onError: (m) => setError(m),
      }),
    [],
  );
  const groupState = useMemo(
    () => createGroupState({ fetchAll: () => fetchAllGroupState(getGroupsApi()), onSnapshot: setSnapshot }),
    [],
  );
  const refreshAll = useCallback(async () => {
    await Promise.all([feed.refresh(), groupState.refresh()]);
  }, [feed, groupState]);
  const loop = useMemo(() => createRefreshLoop({ refresh: refreshAll, intervalMs: REFRESH_RIDERS_MS }), [refreshAll]);
  useEffect(() => () => { loop.dispose(); feed.dispose(); groupState.dispose(); }, [loop, feed, groupState]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    loop.setActive(active && appActive);
  }, [loop, active, appActive]);

  // Alla prima apertura: cerca dove sei, poi apri la mappa su un'area di circa 100 km di raggio.
  useEffect(() => {
    if (!active || looked.current) return;
    looked.current = true;
    findMe().then((me) => {
      setStart(me);
      setShowUser(me !== null);
      setReady(true);
    });
  }, [active]);

  const onRecenter = async () => {
    const me = await findMe();
    if (me) {
      setShowUser(true);
      setRecenter((r) => ({ at: me, n: (r?.n ?? 0) + 1 }));
    } else {
      setError('Non riesco a trovare la tua posizione. Controlla che il GPS sia acceso e il permesso concesso.');
    }
  };

  const onBounds = useCallback((b: BBox) => {
    lastBox.current = b;
    feed.setBox(b);
  }, [feed]);
  const pickCenterAsMeetPoint = () => {
    if (!lastBox.current) return;
    setPicked(bboxCenter(lastBox.current));
    setPicking(false);
  };
  const now = Date.now();

  const onAccept = (r: IncomingRequest) => {
    setAcceptError(null);
    setPicked(null);
    setAccepting(r);
  };
  const closeAccept = () => {
    setAccepting(null);
    setPicking(false);
    setPicked(null);
    setAcceptError(null);
  };
  const confirmAccept = async (choice: MeetChoice, note: string | null) => {
    if (!accepting) return;
    setAcceptBusy(true);
    setAcceptError(null);
    try {
      let meet: MeetPoint = null;
      if (choice === 'map') meet = picked;
      if (choice === 'here') {
        const me = await findMe();
        if (!me) throw new Error('Non riesco a trovare la tua posizione. Scegli un altro modo.');
        meet = { lat: me[1], lng: me[0] };
      }
      await getGroupsApi().respond(accepting.requestId, true, meet, note);
      closeAccept();
      await refreshAll();
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : String(e));
    } finally {
      setAcceptBusy(false);
    }
  };

  // Punto d'incontro da mostrare: quello che sto scegliendo, altrimenti l'ultimo di una mia richiesta accettata.
  const meetPoint = useMemo<[number, number] | null>(() => {
    if (picked) return [picked.lng, picked.lat];
    const m = snapshot.mine.find((r) => r.status === 'accepted' && r.meet && isMeetPointFresh(r.answeredAt, now));
    return m?.meet ? [m.meet.lng, m.meet.lat] : null;
  }, [picked, snapshot.mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => riders.find((r) => r.id === selectedId) ?? null, [riders, selectedId]);

  return (
    <View style={s.root}>
      {ready ? (
        <RidersMap
          riders={riders}
          onBoundsChange={onBounds}
          onSelect={setSelectedId}
          showUser={showUser}
          start={start}
          recenter={recenter}
          meetPoint={meetPoint}
          onMapPress={picking ? ([lng, lat]) => { setPicked({ lat, lng }); setPicking(false); } : undefined}
          onMapError={() => setError('Non riesco a caricare la mappa. Controlla la connessione.')}
        />
      ) : (
        <View style={s.loading}>
          <Text>Cerco la tua posizione…</Text>
        </View>
      )}
      {error && !picking ? (
        <View style={s.error} pointerEvents="none">
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
      {!picking ? (
        <>
          <View style={s.legend} pointerEvents="none">
            <MapLegend />
          </View>
          <TouchableOpacity style={s.recenter} onPress={onRecenter} accessibilityLabel="Ricentra sulla mia posizione">
            <View style={s.target}>
              <View style={s.targetDot} />
            </View>
          </TouchableOpacity>
        </>
      ) : null}
      {picking ? (
        <>
          <View style={s.picking}>
            <Text style={{ fontWeight: '700' }}>Muovi la mappa o toccala: il mirino indica il punto</Text>
          </View>
          <View style={s.crossWrap} pointerEvents="none">
            <View style={s.crossH} />
            <View style={s.crossV} />
            <View style={s.crossDot} />
          </View>
          <View style={s.pickBar}>
            <View style={{ flex: 1 }}><Button title="Usa questo punto" onPress={pickCenterAsMeetPoint} /></View>
            <View style={{ flex: 1 }}><Button title="Annulla" variant="secondary" onPress={() => setPicking(false)} /></View>
          </View>
        </>
      ) : null}
      <View style={[s.bottom, kb > 0 && { bottom: Math.max(0, kb - 60) }, picking && { display: 'none' }]}>
        {selected ? (
          <View style={s.cardWrap}>
            <RiderCard
              rider={selected}
              myGroup={snapshot.group}
              mine={snapshot.mine}
              onClose={() => setSelectedId(null)}
              onChanged={() => void refreshAll()}
            />
          </View>
        ) : null}
        <TrackPanel snapshot={snapshot} nickname={nickname} now={now} onAccept={onAccept} onChanged={() => void refreshAll()} />
      </View>
      <AcceptSheet
        request={picking ? null : accepting}
        picked={picked}
        busy={acceptBusy}
        error={acceptError}
        onCancel={closeAccept}
        onPickOnMap={() => setPicking(true)}
        onConfirm={confirmAccept}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  error: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#991b1b', fontSize: 14 },
  legend: { position: 'absolute', left: 10, top: 110 },
  recenter: {
    position: 'absolute', right: 12, top: 110, width: 46, height: 46, borderRadius: 23, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', elevation: 5, shadowOpacity: 0.25, shadowRadius: 4,
  },
  target: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  targetDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d4ed8' },
  picking: { position: 'absolute', top: 40, left: 16, right: 16, backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, elevation: 6 },
  crossWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  crossH: { position: 'absolute', width: 44, height: 3, backgroundColor: '#dc2626' },
  crossV: { position: 'absolute', width: 3, height: 44, backgroundColor: '#dc2626' },
  crossDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#dc2626', borderWidth: 2, borderColor: 'white' },
  pickBar: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', gap: 8, backgroundColor: 'white', padding: 10, borderRadius: 12, elevation: 6 },
  cardWrap: { marginHorizontal: 12, marginBottom: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

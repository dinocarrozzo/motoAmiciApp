import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, Map, UserLocation, ViewAnnotation, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { bboxFromBounds } from '../../map/bbox';
import { markerColor } from '../../map/riderCard';
import { MAP_STYLE_URL, type BBox, type Rider } from '../../map/types';

type Props = {
  riders: Rider[];
  onBoundsChange: (box: BBox) => void;
  onSelect: (r: Rider) => void;
  showUser: boolean;
  /** [lng, lat] su cui portare la mappa (la prima volta che è nota la posizione). */
  center: [number, number] | null;
  onMapError?: () => void;
};

/** L'unico file che conosce la libreria della mappa. */
export function RidersMap({ riders, onBoundsChange, onSelect, showUser, center, onMapError }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (center) cameraRef.current?.flyTo({ center, zoom: 12, duration: 800 });
  }, [center]);

  return (
    <Map
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE_URL}
      logo={false}
      onRegionDidChange={(e) => onBoundsChange(bboxFromBounds(e.nativeEvent.bounds))}
      onDidFinishLoadingMap={() => {
        void mapRef.current?.getBounds().then((b) => onBoundsChange(bboxFromBounds(b)), () => undefined);
      }}
      onDidFailLoadingMap={() => onMapError?.()}
    >
      <Camera ref={cameraRef} initialViewState={{ center: [12.5, 42.0], zoom: 5 }} />
      {showUser ? <UserLocation /> : null}
      {riders.map((r) => (
        <ViewAnnotation key={r.id} id={r.id} lngLat={[r.lng, r.lat]} onPress={() => onSelect(r)}>
          <TouchableOpacity onPress={() => onSelect(r)} style={[s.pin, { backgroundColor: markerColor(r.gender) }, r.isFriend && s.friend]}>
            <Text style={s.emoji}>🏍️</Text>
            {r.isFriend ? (
              <View style={s.tag}>
                <Text style={s.tagText}>amico</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </ViewAnnotation>
      ))}
    </Map>
  );
}

const s = StyleSheet.create({
  pin: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  friend: { borderColor: '#facc15', borderWidth: 3 },
  emoji: { fontSize: 20 },
  tag: { position: 'absolute', bottom: -10, backgroundColor: '#facc15', borderRadius: 6, paddingHorizontal: 4 },
  tagText: { fontSize: 9, fontWeight: '700', color: '#422006' },
});

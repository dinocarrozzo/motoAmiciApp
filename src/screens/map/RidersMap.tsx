import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { bboxFromBounds } from '../../map/bbox';
import { ridersToGeoJSON } from '../../map/geojson';
import { FALLBACK_VIEW, MAP_STYLE_URL, MAX_ZOOM, MIN_ZOOM, RECENTER_ZOOM, START_ZOOM, type BBox, type Rider } from '../../map/types';

type Props = {
  riders: Rider[];
  onBoundsChange: (box: BBox) => void;
  onSelect: (id: string) => void;
  showUser: boolean;
  /** Posizione iniziale nota all'apertura della mappa, [lng, lat]. */
  start: [number, number] | null;
  /** Ogni nuovo valore riporta la mappa su questa posizione (tasto «ricentra»). */
  recenter: { at: [number, number]; n: number } | null;
  /** Punto d'incontro da mostrare, [lng, lat]. */
  meetPoint: [number, number] | null;
  /** Tocco sulla mappa (usato per scegliere il punto d'incontro). */
  onMapPress?: (lngLat: [number, number]) => void;
  onMapError?: () => void;
};

/** L'unico file che conosce la libreria della mappa. I motociclisti sono cerchi su una sorgente dati (tocco affidabile). */
export function RidersMap({ riders, onBoundsChange, onSelect, showUser, start, recenter, meetPoint, onMapPress, onMapError }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const data = useMemo(() => ridersToGeoJSON(riders), [riders]);
  const meetData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: meetPoint ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: meetPoint }, properties: {} }] : [],
    }),
    [meetPoint],
  );
  // Fissa: se cambiasse a ogni disegno, la mappa potrebbe riportarsi alla vista iniziale.
  const initial = useMemo(() => (start ? { center: start, zoom: START_ZOOM } : FALLBACK_VIEW), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recenter) cameraRef.current?.flyTo({ center: recenter.at, zoom: RECENTER_ZOOM, duration: 800 });
  }, [recenter]);

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
      onPress={(e) => onMapPress?.(e.nativeEvent.lngLat as [number, number])}
      onDidFailLoadingMap={() => onMapError?.()}
    >
      <Camera ref={cameraRef} initialViewState={initial} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
      {showUser ? <UserLocation /> : null}
      <GeoJSONSource
        id="riders"
        data={data}
        hitbox={{ top: 22, bottom: 22, left: 22, right: 22 }}
        onPress={(e) => {
          const id = e.nativeEvent.features?.[0]?.properties?.id;
          if (typeof id === 'string') onSelect(id);
        }}
      >
        <Layer
          id="riders-circles"
          type="circle"
          paint={{
            'circle-radius': 11,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': ['get', 'ring'],
            'circle-stroke-width': 3.5,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="meet" data={meetData}>
        <Layer
          id="meet-circle"
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#16a34a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 }}
        />
      </GeoJSONSource>
    </Map>
  );
}

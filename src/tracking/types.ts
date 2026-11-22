export type TrackPoint = {
  sessionId: string;
  /** Istante della rilevazione, in millisecondi da epoch. */
  recordedAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  /** Velocità in metri al secondo. */
  speed: number | null;
};

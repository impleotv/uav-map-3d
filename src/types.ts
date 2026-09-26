export type Attitude = { heading: number; pitch: number; roll: number };
export type LineStyle = { color: string; width: number; opacity: number };
export type FrustumStyle = { rays: LineStyle; groundOutline: LineStyle };
export type Position = { latitude: number; longitude: number; height: number; reference?: "ellipsoid" | "msl" };
export type GroundPosition = Omit<Position,"height"> & {height?:number};
export type Platform = {
  generation?: string;
  targetFrame?: TargetFrame | null;
  id: string;
  sourceId: string;
  name: string;
  timestamp: string | null;
  position: Position | null;
  attitude: Attitude | null;
  sensor: Attitude | null;
  fov: { horizontal: number; vertical: number } | null;
  frameCenter: GroundPosition | null;
  frameCorners?: (GroundPosition | null)[] | null;
  frameCenterOffEarth?: boolean;
  frameCornersOffEarth?: boolean[];
  range: number | null;
  stale?: boolean;
  status?: string;
  validity?: Partial<Record<"position" | "attitude" | "sensor", "valid" | "missing" | "invalid">>;
};
export type Target = {
  id: string;
  center?: GroundPosition | null;
  boundary?: GroundPosition[] | null;
  boundaryKind?: string | null;
  box?: {left:number;top:number;right:number;bottom:number} | null;
  centroid?: {x:number;y:number} | null;
};
export type TargetFrame = {
  key: string;
  geometry: Pick<Platform,"position"|"attitude"|"sensor"|"fov"|"frameCenter"|"frameCorners"|"frameCenterOffEarth"|"frameCornersOffEarth"|"range">;
  targets: Target[];
};
export type ModelConfig = import("./modelTypes.js").PresentationModel;
export type MapConfig = {
  /** Optional online content. Disabled unless explicitly selected; offline overrides it. */
  ion?: {
    accessToken: string;
    worldTerrain?: boolean;
    osmBuildings?: boolean;
    bingAerial?: boolean;
    googlePhotorealistic?: boolean;
  };
  terrainUrl?: string;
  imageryUrl?: string;
  imageryScheme?: "xyz" | "tms";
  imageryProjection?: "mercator" | "geographic";
  imageryMaxLevel?: number;
  imageryAttribution?: string;
  offline?: boolean;
};
export type CameraMode = "orbit" | "follow" | "sensor";
export type SceneOptions = {
  assetBaseUrl: string;
  cesiumBaseUrl: string;
  onSelect?: (id: string | null) => void;
  onError?: (message: string) => void;
  onStatus?: (id: string, message: string) => void;
  onCameraMode?: (mode: CameraMode) => void;
};

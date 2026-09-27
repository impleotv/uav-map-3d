import type {Viewer} from "cesium";
import type {ReactNode} from "react";
import type {PresentationDraft} from "../modelTypes.js";
import type {MapConfig} from "../types.js";

export type MapEditorProps = {
  value: MapConfig;
  onChange: (value:MapConfig) => void;
  busy?: boolean;
  error?: string;
};

export type PresentationAsset = {id:string; name:string; bundled?:boolean};
export type ModelPreviewProps = {
  config: PresentationDraft;
  assetBaseUrl: string;
  cesiumBaseUrl: string;
  onStatus?: (message:string) => void;
  /** Optional host customization after viewer creation; the component owns disposal. */
  onReady?: (viewer:Viewer) => void;
};
export type PresentationEditorProps = {
  value: PresentationDraft;
  onChange: (value:PresentationDraft) => void;
  models?: PresentationAsset[];
  modelURL?: string;
  assetBaseUrl: string;
  cesiumBaseUrl: string;
  busy?: boolean;
  error?: string;
  /** Omit to hide Upload. File selection, storage and URL resolution belong to the host. */
  onImport?: (kind:"model") => void;
  namePlaceholder?: string;
  nameHelp?: string;
  showPreview?: boolean;
  /** Used by the model-only form; the tabbed editor always validates all tabs. */
  showValidation?: boolean;
  onPreviewReady?: ModelPreviewProps["onReady"];
  /** Supply both props to include map content settings in the editor. */
  mapConfig?: MapConfig;
  onMapConfigChange?: (value:MapConfig) => void;
};

export type {PresentationDraft} from "../modelTypes.js";

export type PresentationPanelProps = {
  choices: {key:string;label:string}[];
  selectedKey: string;
  onSelect: (key:string)=>void;
  description?: string;
  children?: ReactNode;
  loading?: boolean;
  busy?: boolean;
  error?: string;
  saveDisabled?: boolean;
  resetDisabled?: boolean;
  onSave: ()=>void;
  onReset?: ()=>void;
  onClose: ()=>void;
};
export type SceneConfigDraft = Omit<MapConfig,"imageryMaxLevel"> & {
  imageryMode?: "satellite" | "map" | "custom" | "bing";
  terrainAssetId?: string;
  imageryAssetId?: string;
  imageryExtension?: string;
  imageryMaxLevel?: number | "";
};
export type SceneConfigEditorProps = {
  value: SceneConfigDraft;
  onChange: (value:SceneConfigDraft)=>void;
  assets?: {id:string;name:string;kind:string}[];
  busy?: boolean;
  error?: string;
  storageName?: string;
  onRegisterFolder?: (kind:"terrain"|"imagery",path:string)=>Promise<void>;
  onSave: ()=>void;
  onCancel: ()=>void;
};

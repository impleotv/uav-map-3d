import type {Viewer} from "cesium";
import type {PresentationDraft} from "../modelTypes.js";

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
  onPreviewReady?: ModelPreviewProps["onReady"];
};

export type {PresentationDraft} from "../modelTypes.js";

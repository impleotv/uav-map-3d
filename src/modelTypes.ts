/** Reusable model presentation. Identifiers are opaque to the components. */
export type PresentationPreset = "uav" | "helicopter" | "quadcopter" | "camera";
export type PresentationAttitude = {heading:number; pitch:number; roll:number};
export type PresentationPosition = {latitude:number; longitude:number; height:number; reference?:"ellipsoid"|"msl"};
export type PresentationModel = {
  preset:PresentationPreset;
  modelAssetId?:string;
  url?:string;
  name?:string;
  visible?:boolean;
  scale:number;
  headingOffset:number;
  pitchOffset:number;
  rollOffset:number;
  fixedPosition?:PresentationPosition|null;
  fixedAttitude?:PresentationAttitude|null;
};

type NumericDraft<T> = {[K in keyof T]: T[K] extends number ? number | "" : T[K]};
/** Empty numeric fields are valid while editing; validate before saving/rendering. */
export type PresentationDraft = Omit<NumericDraft<PresentationModel>, "fixedPosition" | "fixedAttitude"> & {
  fixedPosition?: NumericDraft<PresentationPosition> | null;
  fixedAttitude?: NumericDraft<PresentationAttitude> | null;
};

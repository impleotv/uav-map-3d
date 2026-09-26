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

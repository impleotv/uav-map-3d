import {defaultFrustumStyle, normalizeFrustumStyle} from "./frustumStyle.mjs";
import {defaultTargetStyle, normalizeTargetStyle} from "./targetStyle.mjs";
export {defaultTargetStyle, normalizeTargetStyle} from "./targetStyle.mjs";
export const presentationPresets = Object.freeze({uav:"UAV / fixed-wing", helicopter:"Helicopter", quadcopter:"Quadcopter", camera:"Stationary camera"});
export const presentationDefaults = Object.freeze({preset:"uav", modelAssetId:"", name:"", visible:true, scale:1, headingOffset:0, pitchOffset:0, rollOffset:0});

export function presentationName(config, fallback) {
  return config?.name?.trim() || fallback;
}

// Layers are passed by the host; this module knows nothing about streams or storage.
export function resolvePresentation(...layers) {
  const result={...presentationDefaults,showVmtiTargets:true,showTarget:true,targetStyle:{...defaultTargetStyle},frustum:{rays:{...defaultFrustumStyle.rays},groundOutline:{...defaultFrustumStyle.groundOutline}}};
  for(const layer of layers.filter(Boolean)) {
    const {frustum,targetStyle,...fields}=layer;
    Object.assign(result,Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==undefined)));
    Object.assign(result.targetStyle,targetStyle);
    for(const key of ["rays","groundOutline"])Object.assign(result.frustum[key],frustum?.[key]);
  }
  return result;
}

export function presentationError(value) {
  if(value.showVmtiTargets!==undefined&&typeof value.showVmtiTargets!=="boolean")return "Target visibility must be a boolean.";
  if(value.showTarget!==undefined&&typeof value.showTarget!=="boolean")return "Show Target must be a boolean.";
  try {normalizeFrustumStyle(value.frustum);} catch(error) {return error.message;}
  try {normalizeTargetStyle(value.targetStyle);} catch(error) {return error.message;}
  if (!Object.hasOwn(presentationPresets, value.preset)) return "Choose a supported preset.";
  if (typeof (value.name??"") !== "string" || (value.name??"").length > 256) return "Display name must be at most 256 characters.";
  if (!Number.isFinite(value.scale) || value.scale < 0.001 || value.scale > 1000) return "Scale must be between 0.001 and 1000.";
  for (const key of ["headingOffset","pitchOffset","rollOffset"]) {
    if (!Number.isFinite(value[key]) || Math.abs(value[key]) > 360) return "Alignment must be between -360 and 360 degrees.";
  }
  const check = (group, limits) => group && Object.entries(limits).some(([key,[min,max]])=>!Number.isFinite(group[key]) || group[key]<min || group[key]>max);
  if (check(value.fixedPosition, {latitude:[-90,90],longitude:[-180,180],height:[-100000,100000]})) return "Enter a valid fixed position.";
  if (check(value.fixedAttitude, {heading:[0,360],pitch:[-90,90],roll:[-180,180]})) return "Enter a valid fixed mounting attitude.";
  return "";
}

export function modelUrl(config, assetBaseUrl) {
  return config.url || new URL(`models/${config.preset}.gltf`, assetBaseUrl).href;
}

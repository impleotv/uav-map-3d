export const presentationPresets = Object.freeze({uav:"UAV / fixed-wing", helicopter:"Helicopter", quadcopter:"Quadcopter", camera:"Stationary camera"});
export const presentationDefaults = Object.freeze({preset:"uav", modelAssetId:"", name:"", visible:true, scale:1, headingOffset:0, pitchOffset:0, rollOffset:0});

export function presentationName(config, fallback) {
  return config?.name?.trim() || fallback;
}

// Layers are passed by the host; this module knows nothing about streams or storage.
export function resolvePresentation(...layers) {
  return Object.assign({}, presentationDefaults, ...layers.filter(Boolean));
}

export function presentationError(value) {
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

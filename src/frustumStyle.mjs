export const defaultFrustumStyle = Object.freeze({
  rays:Object.freeze({color:"#65c9ff",width:1,opacity:0.3}),
  groundOutline:Object.freeze({color:"#65c9ff",width:3,opacity:0.9}),
});

/** @returns {import("./types.js").FrustumStyle} */
export function normalizeFrustumStyle(value = {}) {
  const result={};
  for(const key of ["rays","groundOutline"]) {
    const style={...defaultFrustumStyle[key],...value[key]};
    if(!/^#[0-9a-f]{6}$/i.test(style.color))throw new Error("Line color must be a six-digit hex color");
    if(!Number.isFinite(style.width)||style.width<0.5||style.width>10)throw new Error("Line thickness must be between 0.5 and 10 pixels");
    if(!Number.isFinite(style.opacity)||style.opacity<0||style.opacity>1)throw new Error("Line opacity must be between 0 and 1");
    result[key]=style;
  }
  return result;
}

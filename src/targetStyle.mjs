export const defaultTargetStyle = Object.freeze({color:"#ff0000",width:2,crosshairSize:24});

/** @param {Partial<import("./types.js").TargetStyle>} [value]
 * @returns {import("./types.js").TargetStyle} */
export function normalizeTargetStyle(value = {}) {
  const style={...defaultTargetStyle,...value};
  if(!/^#[0-9a-f]{6}$/i.test(style.color))throw new Error("Target color must be a six-digit hex color");
  if(!Number.isFinite(style.width)||style.width<0.5||style.width>10)throw new Error("Target line thickness must be between 0.5 and 10 pixels");
  if(!Number.isFinite(style.crosshairSize)||style.crosshairSize<8||style.crosshairSize>128)throw new Error("Target crosshair size must be between 8 and 128 pixels");
  return style;
}

/** A screen-sized icon with a fixed two-pixel stroke and an open center.
 * @param {import("./types.js").TargetStyle} style */
export function targetCrosshairImage(style) {
  const size=style.crosshairSize,center=size/2,gap=Math.min(4,size/6);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="M ${center} 2 V ${center-gap} M ${center} ${center+gap} V ${size-2} M 2 ${center} H ${center-gap} M ${center+gap} ${center} H ${size-2}" fill="none" stroke="${style.color}" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

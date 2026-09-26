import React from "react";
import "./presentation.css";

/** @param {import("../types.js").MapConfig} value */
export function mapConfigError(value) {
  const ion=value.ion;
  return !value.offline && ion && (ion.worldTerrain||ion.osmBuildings||ion.bingAerial||ion.googlePhotorealistic) && !ion.accessToken?.trim()
    ? "Enter your Cesium ion access token to use the selected online layers." : "";
}

/** @param {import("./types.js").MapEditorProps} props */
export function MapEditor({value,onChange,busy=false,error=""}) {
  const updateIon=patch=>onChange({...value,ion:{accessToken:"",...value.ion,...patch}});
  const message=error||mapConfigError(value);
  return <section className="uav3d-editor uav3d-map-editor" aria-label="Map content">
    <h3>Map content</h3>
    <fieldset disabled={busy}>
      <label className="uav3d-check"><input type="checkbox" checked={!!value.offline} onChange={e=>onChange({...value,offline:e.target.checked})}/>Offline mode</label>
      <p className="uav3d-map-help">Optional online layers require your own Cesium ion token. Leave them unchecked to use the existing map sources.</p>
      <label className="uav3d-map-token">Cesium ion access token
        <input type="password" autoComplete="off" spellCheck={false} disabled={!!value.offline} value={value.ion?.accessToken??""} onChange={e=>updateIon({accessToken:e.target.value})} placeholder="Paste your token" aria-invalid={!!mapConfigError(value)}/>
      </label>
      {[["worldTerrain","Cesium World Terrain",!!value.terrainUrl],["osmBuildings","Cesium OSM Buildings",false],["bingAerial","Bing Maps Aerial imagery",!!value.imageryUrl],["googlePhotorealistic","Google Photorealistic 3D Tiles",false]].map(([key,label,overridden])=>
        <label className="uav3d-check" key={key}><input type="checkbox" checked={!!value.ion?.[key]} disabled={!!value.offline||overridden} onChange={e=>updateIon({[key]:e.target.checked})}/>{label}{overridden&&" (custom URL takes precedence)"}</label>)}
      {value.offline&&<p className="uav3d-map-help">Online layers are disabled in offline mode.</p>}
      {value.ion?.googlePhotorealistic&&<p className="uav3d-map-help">Google replaces the visible globe and OSM buildings when loaded. Turn it off to restore your map. Enable Google Photorealistic 3D Tiles in your Cesium ion account and allow access for this token.</p>}
    </fieldset>
    <p className="uav3d-map-help"><a href="https://ion.cesium.com/" target="_blank" rel="noreferrer">Get a Cesium ion token</a>. Your token is not saved by this editor.</p>
    {message&&<p role="alert">{message}</p>}
  </section>;
}

import React, {useState} from "react";
import "./presentation.css";

function TokenRemoval({disabled,onRemove}) {
  const [confirming,setConfirming]=useState(false);
  if(!confirming)return <button type="button" className="uav3d-map-token-remove" title="Remove Cesium ion token" aria-label="Remove Cesium ion token" disabled={disabled} onClick={()=>setConfirming(true)}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>
    </svg>
  </button>;
  return <div className="uav3d-map-token-confirm" role="group" aria-label="Confirm token removal">
    <p className="uav3d-map-help">Remove the Cesium ion token and turn off the online layers that require it?</p>
    <button type="button" disabled={disabled} onClick={()=>{onRemove();setConfirming(false);}}>Confirm removal</button>
    <button type="button" onClick={()=>setConfirming(false)}>Cancel</button>
  </div>;
}

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
  return <details className="uav3d-editor uav3d-map-editor" aria-label="Map content" open>
    <summary>Map content</summary>
    <fieldset disabled={busy}>
      <label className="uav3d-check"><input type="checkbox" checked={!!value.offline} onChange={e=>onChange({...value,offline:e.target.checked})}/>Offline mode</label>
      <p className="uav3d-map-help">Optional online layers require your own Cesium ion token. Leave them unchecked to use the existing map sources.</p>
      <div className="uav3d-map-token">
      <label>Cesium ion access token
        <input type="password" autoComplete="off" spellCheck={false} disabled={!!value.offline} value={value.ion?.accessToken??""} onChange={e=>updateIon({accessToken:e.target.value})} placeholder="Paste your token" aria-invalid={!!mapConfigError(value)}/>
      </label>
      <TokenRemoval disabled={busy||!value.ion?.accessToken} onRemove={()=>updateIon({accessToken:"",worldTerrain:false,osmBuildings:false,bingAerial:false,googlePhotorealistic:false})}/>
      </div>
      {[["worldTerrain","Cesium World Terrain",!!value.terrainUrl],["osmBuildings","Cesium OSM Buildings",false],["bingAerial","Bing Maps Aerial imagery",!!value.imageryUrl],["googlePhotorealistic","Google Photorealistic 3D Tiles",false]].map(([key,label,overridden])=>
        <label className="uav3d-check" key={key}><input type="checkbox" checked={!!value.ion?.[key]} disabled={!!value.offline||overridden} onChange={e=>updateIon({[key]:e.target.checked})}/>{label}{overridden&&" (custom URL takes precedence)"}</label>)}
      {value.offline&&<p className="uav3d-map-help">Online layers are disabled in offline mode.</p>}
      {value.ion?.googlePhotorealistic&&<p className="uav3d-map-help">Google replaces the visible globe and OSM buildings when loaded. Turn it off to restore your map. Enable Google Photorealistic 3D Tiles in your Cesium ion account and allow access for this token.</p>}
    </fieldset>
    <p className="uav3d-map-help"><a href="https://ion.cesium.com/" target="_blank" rel="noreferrer">Get a Cesium ion token</a>. Your token is not saved by this editor.</p>
    {message&&<p role="alert">{message}</p>}
  </details>;
}

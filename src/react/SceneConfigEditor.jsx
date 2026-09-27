import React, {useState} from "react";
import {MapEditor, mapConfigError} from "./MapEditor.js";
import "./presentation.css";

/** @param {import("./types.js").SceneConfigEditorProps} props */
export function SceneConfigEditor({value,onChange,assets=[],busy=false,error="",storageName="the application",onRegisterFolder,onSave,onCancel}) {
  const [folder,setFolder]=useState(""),[kind,setKind]=useState("terrain"),[registering,setRegistering]=useState(false),[folderError,setFolderError]=useState("");
  const update=patch=>onChange({...value,...patch});
  const content={...value,terrainUrl:value.terrainAssetId?"local-folder":value.terrainUrl,imageryUrl:value.imageryMode==="custom"?(value.imageryAssetId?"local-folder":value.imageryUrl):"",ion:{...value.ion,bingAerial:value.imageryMode==="bing"}};
  const disabled=busy||registering;
  const register=async()=>{
    setRegistering(true);setFolderError("");
    try {await onRegisterFolder(kind,folder);setFolder("");}
    catch(error){setFolderError(String(error));}
    finally {setRegistering(false);}
  };
  return <div className="uav3d-editor">
    <MapEditor value={content} busy={disabled} onChange={next=>update({offline:next.offline,ion:next.ion,imageryMode:next.ion?.bingAerial?"bing":value.imageryMode==="bing"?"satellite":value.imageryMode})}/>
    <p className="uav3d-map-help">Save stores your token in {storageName}'s local configuration. Cancel discards edits.</p>
    <details className="uav3d-section"><summary>Advanced: terrain and imagery</summary>
      <fieldset disabled={disabled}>
        <label className="uav3d-wide">Imagery<select value={value.imageryMode||"satellite"} onChange={e=>update({imageryMode:e.target.value})}><option value="satellite">Satellite</option><option value="map">Map</option><option value="custom">Custom imagery</option>{value.ion?.accessToken?.trim()&&<option value="bing">Bing Aerial (your token)</option>}</select></label>
        <p className="uav3d-map-help">Custom imagery uses your own tile server or local tile folder.</p>
        <p className="uav3d-map-help">Offline mode uses chosen folders or your local tile server. It does not fall back to online imagery.</p>
        {[["terrain","Terrain"],...(value.imageryMode==="custom"?[["imagery","Imagery"]]:[])].map(([kind,label])=><React.Fragment key={kind}>
          <label className="uav3d-wide">{label} source<select value={value[`${kind}AssetId`]||""} onChange={e=>update({[`${kind}AssetId`]:e.target.value})}><option value="">{kind==="terrain"?"Ellipsoid / server URL":"Server URL"}</option>{assets.filter(asset=>asset.kind===kind).map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          {!value[`${kind}AssetId`]&&<label className="uav3d-wide">{label} server URL<input placeholder={kind==="terrain"?"http://localhost:8000/terrain/":"http://localhost:8000/{z}/{x}/{y}.png"} value={value[`${kind}Url`]||""} onChange={e=>update({[`${kind}Url`]:e.target.value})}/></label>}
        </React.Fragment>)}
        {value.imageryMode==="custom"&&<>
          <label>Imagery layout<select value={value.imageryScheme||"xyz"} onChange={e=>update({imageryScheme:e.target.value})}><option value="xyz">XYZ</option><option value="tms">TMS</option></select></label>
          <label>Imagery projection<select value={value.imageryProjection||"mercator"} onChange={e=>update({imageryProjection:e.target.value})}><option value="mercator">Web Mercator</option><option value="geographic">Geographic (2 × 1 root tiles)</option></select></label>
          <label>Tile image format<select value={value.imageryExtension||"png"} onChange={e=>update({imageryExtension:e.target.value})}>{["png","jpg","jpeg","webp"].map(ext=><option key={ext} value={ext}>{ext.toUpperCase()}</option>)}</select></label>
          <label>Maximum imagery level<input type="number" min="0" max="24" value={value.imageryMaxLevel??19} onChange={e=>update({imageryMaxLevel:e.target.value===""?"":Number(e.target.value)})}/></label>
          <label className="uav3d-wide">Imagery attribution<input value={value.imageryAttribution||""} onChange={e=>update({imageryAttribution:e.target.value})}/></label>
        </>}
      </fieldset>
      {onRegisterFolder&&<fieldset className="uav3d-folder" disabled={disabled}><legend>Register a local folder</legend>
        <label>Folder type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="terrain">Cesium terrain</option><option value="imagery">Imagery tiles</option></select></label>
        <label>Folder path<input placeholder="Absolute path on this computer" value={folder} onChange={e=>setFolder(e.target.value)}/></label>
        <button type="button" disabled={!folder.trim()} onClick={()=>void register()}>Register folder</button>
      </fieldset>}
      {folderError&&<p role="alert">{folderError}</p>}
    </details>
    {(error||sceneConfigError(value))&&<p role="alert">{error||sceneConfigError(value)}</p>}
    <div className="uav3d-actions">
      <button type="button" disabled={disabled||!!sceneConfigError(value)} onClick={onSave}>{busy?"Saving…":"Save"}</button>
      <button type="button" disabled={disabled} onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}

/** @param {import("./types.js").SceneConfigDraft} value */
export function sceneConfigError(value) {
  const error=mapConfigError({...value,ion:{...value.ion,bingAerial:value.imageryMode==="bing"}});
  if(error)return error;
  if(value.imageryMaxLevel!==undefined&&(!Number.isInteger(value.imageryMaxLevel)||Number(value.imageryMaxLevel)<0||Number(value.imageryMaxLevel)>24))return "Imagery maximum level must be between 0 and 24.";
  return "";
}

import React, {lazy, Suspense} from "react";
import {presentationPresets, presentationError} from "../models.mjs";
import "./presentation.css";
const ModelPreview = lazy(()=>import("./ModelPreview.js"));

/** @param {import("./types.js").PresentationEditorProps} props */
export function PresentationEditor({value, models=[], modelURL="", assetBaseUrl, cesiumBaseUrl, busy=false, error="", onChange, onImport, namePlaceholder="Automatic", nameHelp="Leave blank to use the name supplied by the host application.", showPreview=true, onPreviewReady}) {
  const update=patch=>onChange({...value,...patch});
  // Uploaded copies can share a name with each other or a bundled model.
  // Retain the selected asset so opening the editor never changes its identity.
  const uniqueModels=new Map();
  for(const model of [...models].sort((a,b)=>Number(!!b.bundled)-Number(!!a.bundled)||a.id.localeCompare(b.id))){
    const name=model.name.trim().replace(/\.(glb|gltf)$/i,"").toLowerCase();
    if(!uniqueModels.has(name)||model.id===value.modelAssetId)uniqueModels.set(name,model);
  }
  const numeric=(key,label,group)=> <label key={key}>{label}<input type="number" step="any" value={(group?value[group]?.[key]:value[key])??""} onChange={e=>{
    const number=e.target.value===""?"":Number(e.target.value);
    update(group?{[group]:{...value[group],[key]:number}}:{[key]:number});
  }}/></label>;
  return <div className="uav3d-editor">
    <fieldset disabled={busy}>
      <label title={nameHelp}>Display name<input maxLength={256} placeholder={namePlaceholder} title={nameHelp} value={value.name||""} onChange={e=>update({name:e.target.value})}/></label>
      <label>Preset<select value={value.preset} onChange={e=>update({preset:e.target.value,modelAssetId:""})}>{Object.entries(presentationPresets).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <div className="uav3d-model-field"><label>Model<select value={value.modelAssetId||""} onChange={e=>update({modelAssetId:e.target.value})}><option value="">Aircraft</option>{[[true,"Bundled models"],[false,"Uploaded models"]].map(([bundled,label])=>{
        const entries=[...uniqueModels.values()].filter(model=>!!model.bundled===bundled).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
        return entries.length>0&&<optgroup key={label} label={label}>{entries.map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>;
      })}</select></label>{onImport&&<button type="button" className="uav3d-upload" title="Upload a GLB or glTF model to the model library" onClick={()=>onImport("model")}>Upload</button>}</div>
      {[["scale","Scale"],["headingOffset","Heading alignment (°)"],["pitchOffset","Pitch alignment (°)"],["rollOffset","Roll alignment (°)"]].map(([key,label])=>numeric(key,label))}
      <label className="uav3d-check"><input type="checkbox" checked={value.visible!==false} onChange={e=>update({visible:e.target.checked})}/>Visible</label>
      {value.preset==="camera"&&<>
        <label className="uav3d-check"><input type="checkbox" checked={!!value.fixedPosition} onChange={e=>update({fixedPosition:e.target.checked?{latitude:0,longitude:0,height:0}:null})}/>Use fixed position when telemetry is absent</label>
        {value.fixedPosition&&[["latitude","Latitude"],["longitude","Longitude"],["height","Ellipsoid height (m)"]].map(([key,label])=>numeric(key,label,"fixedPosition"))}
        <label className="uav3d-check"><input type="checkbox" checked={!!value.fixedAttitude} onChange={e=>update({fixedAttitude:e.target.checked?{heading:0,pitch:0,roll:0}:null})}/>Use fixed mounting attitude when telemetry is absent</label>
        {value.fixedAttitude&&["heading","pitch","roll"].map(key=>numeric(key,`${key} (°)`,"fixedAttitude"))}
      </>}
    </fieldset>
    {(error||presentationError(value))&&<p role="alert">{error||presentationError(value)}</p>}
    {showPreview&&(value.modelAssetId&&!modelURL?<p role="status">Selected model is loading or unavailable. Choose another model if it cannot be found.</p>:<Suspense fallback={<p>Loading model preview…</p>}><ModelPreview config={{...value,url:modelURL}} assetBaseUrl={assetBaseUrl} cesiumBaseUrl={cesiumBaseUrl} onReady={onPreviewReady}/></Suspense>)}
  </div>;
}

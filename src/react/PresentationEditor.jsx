import React, {lazy, Suspense, useId, useState} from "react";
import {presentationPresets, presentationError} from "../models.mjs";
import "./presentation.css";
import {defaultFrustumStyle} from "../frustumStyle.mjs";
import {defaultTargetStyle} from "../targetStyle.mjs";
import {MapEditor} from "./MapEditor.js";
const ModelPreview = lazy(()=>import("./ModelPreview.js"));

/** @param {import("./types.js").PresentationEditorProps} props */
export function ModelEditor({value, models=[], modelURL="", assetBaseUrl, cesiumBaseUrl, busy=false, error="", onChange, onImport, namePlaceholder="Automatic", nameHelp="Leave blank to use the name supplied by the host application.", showPreview=true, onPreviewReady, mapConfig, onMapConfigChange, showValidation=true}) {
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
    {showValidation&&(error||presentationError(value))&&<p role="alert">{error||presentationError(value)}</p>}
    {showPreview&&(value.modelAssetId&&!modelURL?<p role="status">Selected model is loading or unavailable. Choose another model if it cannot be found.</p>:<Suspense fallback={<p>Loading model preview…</p>}><ModelPreview config={{...value,url:modelURL}} assetBaseUrl={assetBaseUrl} cesiumBaseUrl={cesiumBaseUrl} onReady={onPreviewReady}/></Suspense>)}
  </div>;
}

/** @param {import("./types.js").PresentationEditorProps} props */
export function PresentationEditor(props) {
  const [tab,setTab]=useState("model"), id=useId();
  const {value,onChange,busy=false,mapConfig,onMapConfigChange}=props;
  const tabs=[["model","Model"],["target","Target"],["vmti","VMTI"],["frustum","Frustum"]];
  const update=patch=>onChange({...value,...patch});
  const targetStyle={...defaultTargetStyle,...value.targetStyle};
  const changeTargetStyle=patch=>update({targetStyle:{...targetStyle,...patch}});
  const keyboard=event=>{
    const current=tabs.findIndex(([key])=>key===tab);
    const index=event.key==="Home"?0:event.key==="End"?tabs.length-1:event.key==="ArrowRight"?(current+1)%tabs.length:event.key==="ArrowLeft"?(current+tabs.length-1)%tabs.length:null;
    if(index===null)return;
    event.preventDefault();setTab(tabs[index][0]);
    event.currentTarget.querySelectorAll('[role="tab"]')[index].focus();
  };
  return <div className="uav3d-editor">
    <div className="uav3d-tabs" role="tablist" aria-label="Presentation settings" onKeyDown={keyboard}>
      {tabs.map(([key,label])=><button key={key} type="button" role="tab" id={`${id}-${key}-tab`} aria-controls={`${id}-${key}`} aria-selected={tab===key} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)}>{label}</button>)}
    </div>
    {tabs.map(([key])=><div key={key} role="tabpanel" id={`${id}-${key}`} aria-labelledby={`${id}-${key}-tab`} hidden={tab!==key} tabIndex={0}>
      {key==="model"&&<ModelEditor {...props} showValidation={false} error="" showPreview={props.showPreview!==false&&tab==="model"}/>}
      {key==="target"&&<fieldset disabled={busy}>
        <label className="uav3d-check"><input type="checkbox" checked={value.showTarget!==false} onChange={e=>update({showTarget:e.target.checked})}/>Show Target</label>
        <p className="uav3d-map-help">MISB ST 0601 target location (tags 40–42). The crosshair and dashed line use the same color.</p>
        <label>Color<input type="color" aria-label="Target color" value={targetStyle.color} onChange={e=>changeTargetStyle({color:e.target.value})}/></label>
        <label>Line thickness (pixels)<input type="number" aria-label="Target line thickness" min="0.5" max="10" step="0.5" value={targetStyle.width} onChange={e=>changeTargetStyle({width:e.target.value===""?"":Number(e.target.value)})}/></label>
        <label>Crosshair size (pixels)<input type="number" aria-label="Target crosshair size" min="8" max="128" step="1" value={targetStyle.crosshairSize} onChange={e=>changeTargetStyle({crosshairSize:e.target.value===""?"":Number(e.target.value)})}/></label>
        <button type="button" disabled={busy} onClick={()=>update({targetStyle:{...defaultTargetStyle}})}>Reset target appearance</button>
      </fieldset>}
      {key==="vmti"&&<fieldset disabled={busy}>
        <label className="uav3d-check"><input type="checkbox" checked={value.showVmtiTargets!==false} onChange={e=>update({showVmtiTargets:e.target.checked})}/>Show VMTI targets</label>
        <p className="uav3d-map-help">Green: reported boundary or location. Dashed amber: estimated from the frame footprint. Hover for target details.</p>
      </fieldset>}
      {key==="frustum"&&<>
        {[["groundOutline","Footprint"],["rays","Aircraft-to-ground lines"]].map(([styleKey,label])=>{
          const style={...defaultFrustumStyle[styleKey],...value.frustum?.[styleKey]};
          const change=patch=>update({frustum:{...value.frustum,[styleKey]:{...style,...patch}}});
          return <details className="uav3d-section" key={styleKey} open>
            <summary>{label}</summary><fieldset disabled={busy}>
              <label>Color<input type="color" aria-label={`${label} color`} value={style.color} onChange={e=>change({color:e.target.value})}/></label>
              <label>Thickness (pixels)<input type="number" aria-label={`${label} thickness`} min="0.5" max="10" step="0.5" value={style.width} onChange={e=>change({width:e.target.value===""?"":Number(e.target.value)})}/></label>
              <label className="uav3d-wide">Opacity ({Math.round(style.opacity*100)}%)<input type="range" aria-label={`${label} opacity`} min="0" max="100" value={Math.round(style.opacity*100)} onChange={e=>change({opacity:Number(e.target.value)/100})}/></label>
            </fieldset>
          </details>;
        })}
        <button type="button" disabled={busy} onClick={()=>update({frustum:{rays:{...defaultFrustumStyle.rays},groundOutline:{...defaultFrustumStyle.groundOutline}}})}>Reset frustum appearance</button>
      </>}
    </div>)}
    {(props.error||presentationError(value))&&<p role="alert">{props.error||presentationError(value)}</p>}
    {mapConfig&&onMapConfigChange&&<MapEditor value={mapConfig} onChange={onMapConfigChange} busy={busy}/>}
  </div>;
}

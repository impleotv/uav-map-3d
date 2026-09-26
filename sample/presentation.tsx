import React, {StrictMode, useState} from "react";
import {createRoot} from "react-dom/client";
import {PresentationEditor, type PresentationDraft} from "@impleotv-pm/uav-map-3d/react";
import {presentationDefaults, presentationError} from "@impleotv-pm/uav-map-3d/models";
import type {MapConfig} from "@impleotv-pm/uav-map-3d";

function Example() {
  const [value,setValue]=useState<PresentationDraft>({...presentationDefaults});
  const [mapConfig,setMapConfig]=useState<MapConfig>({});
  const [open,setOpen]=useState(true);
  const [showPreview,setShowPreview]=useState(true);
  return <>
    <div className="actions"><button onClick={()=>setOpen(!open)}>{open?"Close editor":"Open editor"}</button><button onClick={()=>setValue({...presentationDefaults})}>Reset settings</button><label><input type="checkbox" checked={showPreview} onChange={e=>setShowPreview(e.target.checked)}/>Show preview</label></div>
    {open&&<PresentationEditor value={value} onChange={setValue} mapConfig={mapConfig} onMapConfigChange={setMapConfig} assetBaseUrl={new URL("./scene/",location.href).href} cesiumBaseUrl={new URL("./cesium/",location.href).href} showPreview={showPreview}/>}
    <p role="status">{presentationError(value)?"Draft has invalid fields":"Draft is valid"}</p>
    <details><summary>Current host-owned value</summary><pre>{JSON.stringify(value,null,2)}</pre></details>
  </>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Example/></StrictMode>);

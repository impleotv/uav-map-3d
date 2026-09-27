import React, {StrictMode, useState} from "react";
import {createRoot} from "react-dom/client";
import {PresentationEditor, PresentationPanel, SceneConfigEditor, type SceneConfigDraft, type PresentationDraft} from "@impleotv-pm/uav-map-3d/react";
import {presentationDefaults, presentationError} from "@impleotv-pm/uav-map-3d/models";

function Example() {
  const [theme,setTheme]=useState<"light"|"dark">("dark");
  const [value,setValue]=useState<PresentationDraft>({...presentationDefaults});
  const [mapConfig,setMapConfig]=useState<SceneConfigDraft>({imageryMode:"satellite"});
  const [open,setOpen]=useState(true);
  const [showPreview,setShowPreview]=useState(true);
  const [mapOpen,setMapOpen]=useState(false);
  const [saved,setSaved]=useState("");
  return <div data-uav3d-theme={theme} style={{background:"var(--uav3d-surface-background)",color:"var(--uav3d-text-color)",padding:16}}>
    <label>Color scheme <select value={theme} onChange={e=>setTheme(e.target.value as "light"|"dark")}><option value="dark">Dark</option><option value="light">Light</option></select></label>
    <div className="actions"><button onClick={()=>setOpen(!open)}>{open?"Close editor":"Open editor"}</button><button onClick={()=>setValue({...presentationDefaults})}>Reset settings</button><label><input type="checkbox" checked={showPreview} onChange={e=>setShowPreview(e.target.checked)}/>Show preview</label></div>
    {open&&<PresentationPanel choices={[{key:"example",label:"Example platform"}]} selectedKey="example" onSelect={()=>{}} onSave={()=>setSaved("Presentation saved")} onClose={()=>setOpen(false)} saveDisabled={!!presentationError(value)}><PresentationEditor value={value} onChange={setValue} assetBaseUrl={new URL("./scene/",location.href).href} cesiumBaseUrl={new URL("./cesium/",location.href).href} showPreview={showPreview}/></PresentationPanel>}
    <button onClick={()=>setMapOpen(!mapOpen)}>Configure map</button>
    {mapOpen&&<SceneConfigEditor value={mapConfig} onChange={setMapConfig} onSave={()=>{setSaved("Map settings saved");setMapOpen(false);}} onCancel={()=>setMapOpen(false)}/>}
    {saved&&<p>{saved}</p>}
    <p role="status">{presentationError(value)?"Draft has invalid fields":"Draft is valid"}</p>
    <details><summary>Current host-owned value</summary><pre>{JSON.stringify(value,null,2)}</pre></details>
  </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Example/></StrictMode>);

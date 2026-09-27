import React from "react";
import "./presentation.css";

/** Shared form chrome; the host supplies source identities and persistence. */
/** @param {import("./types.js").PresentationPanelProps} props */
export function PresentationPanel({choices,selectedKey,onSelect,description,children,loading=false,busy=false,error="",saveDisabled=false,resetDisabled=false,onSave,onReset,onClose}) {
  return <div className="uav3d-editor uav3d-presentation-panel">
    <strong>Presentation</strong>
    <select aria-label="Source or KLV track" value={selectedKey} disabled={busy} onChange={e=>onSelect(e.target.value)}>{choices.map(choice=><option key={choice.key} value={choice.key}>{choice.label}</option>)}</select>
    {!choices.length?<p>Open a source to configure its presentation.</p>:loading?<p>Loading presentation…</p>:children}
    {description&&<p className="uav3d-map-help">{description}</p>}
    {error&&<p role="alert">{error}</p>}
    <div className="uav3d-actions">
      <button type="button" disabled={busy||loading||!choices.length||saveDisabled} onClick={onSave}>{busy?"Saving…":"Save"}</button>
      {onReset&&<button type="button" disabled={busy||loading||resetDisabled} onClick={onReset}>Use source settings</button>}
      <button type="button" disabled={busy} onClick={onClose}>Close</button>
    </div>
  </div>;
}

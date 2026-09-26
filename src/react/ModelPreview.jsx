import React, {useEffect, useRef, useState} from "react";
import {Viewer, Model, Cartesian3, Color, ConstantProperty, Transforms, Matrix4, HeadingPitchRange, buildModuleUrl} from "cesium";
import "../styles.css";
import {modelOrientation} from "../orientation.mjs";
import "./presentation.css";
import {modelUrl, presentationError} from "../models.mjs";

// No telemetry, backend, or imagery dependency. The caller supplies resolved URLs.
/** @param {import("./types.js").ModelPreviewProps} props */
export default function ModelPreview({config, assetBaseUrl, cesiumBaseUrl, onStatus, onReady}) {
  const host=useRef(null), renderer=useRef(null), previousURL=useRef("");
  const [status,setStatus]=useState("Loading model…"), [ready,setReady]=useState(false);
  const readyCallback=useRef(onReady); readyCallback.current=onReady;
  const callback=useRef(onStatus); callback.current=onStatus;
  const report=message=>{setStatus(message);callback.current?.(message);};
  const reset=()=>{
    const current=renderer.current;
    if(current)current.viewer.trackedEntity=undefined;
    if(current)void current.viewer.zoomTo(current.entity,new HeadingPitchRange(-Math.PI/4,-Math.PI/6,0)).then(ok=>{
      if(renderer.current!==current)return;
      if(ok){current.viewer.trackedEntity=current.entity;report("Drag to rotate · Scroll to zoom");}
    }).catch(error=>{if(renderer.current===current)report(`Preview unavailable: ${error.message}`);});
  };
  useEffect(()=>{
    let viewer, resize;
    setReady(false);
    try {
      buildModuleUrl.setBaseUrl(cesiumBaseUrl);
      viewer=new Viewer(host.current,{baseLayer:false,globe:false,skyBox:false,skyAtmosphere:false,
        animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,
        sceneModePicker:false,fullscreenButton:false,navigationHelpButton:false,infoBox:false,selectionIndicator:false,
        requestRenderMode:true,maximumRenderTimeChange:Infinity});
      readyCallback.current?.(viewer);
      viewer.scene.backgroundColor=Color.fromCssColorString("#101923");
      if(viewer.scene.sun)viewer.scene.sun.show=false;
      if(viewer.scene.moon)viewer.scene.moon.show=false;
      const position=Cartesian3.fromDegrees(0,0,0);
      const entity=viewer.entities.add({position});
      const frame=Transforms.eastNorthUpToFixedFrame(position);
      for(const [label,axis,color] of [["East",new Cartesian3(10,0,0),Color.RED],["North",new Cartesian3(0,10,0),Color.LIME],["Up",new Cartesian3(0,0,10),Color.CYAN]]) {
        const end=Matrix4.multiplyByPoint(frame,axis,new Cartesian3());
        viewer.entities.add({position:end,label:{text:label,font:"12px sans-serif",fillColor:color},polyline:{positions:[position,end],width:2,material:color}});
      }
      renderer.current={viewer,entity,position};
      viewer.scene.renderError.addEventListener((_scene,error)=>report(`Preview unavailable: ${error.message}`));
      viewer.scene.primitives.primitiveAdded.addEventListener(primitive=>{
        if(primitive instanceof Model)primitive.errorEvent.addEventListener(error=>report(`Model could not load: ${error.message}`));
      });
      resize=new ResizeObserver(()=>{if(!viewer.isDestroyed()){viewer.resize();viewer.scene.requestRender();}});
      resize.observe(host.current);setReady(true);
    } catch(error) {report(`Preview unavailable: ${error.message}`);}
    return ()=>{resize?.disconnect();renderer.current=null;previousURL.current="";if(viewer&&!viewer.isDestroyed())viewer.destroy();};
  },[cesiumBaseUrl,assetBaseUrl]);
  useEffect(()=>{
    const current=renderer.current;
    if(!ready||!current||presentationError(config))return;
    const {viewer,entity,position}=current;
    const url=modelUrl(config,assetBaseUrl), changed=url!==previousURL.current;
    entity.orientation=new ConstantProperty(modelOrientation(position,{heading:0,pitch:0,roll:0},{heading:config.headingOffset,pitch:config.pitchOffset,roll:config.rollOffset}));
    entity.model={uri:url,scale:config.scale};
    viewer.scene.requestRender();
    if(changed){
      viewer.trackedEntity=undefined;
      previousURL.current=url;report("Loading model…");
      void viewer.zoomTo(entity,new HeadingPitchRange(-Math.PI/4,-Math.PI/6,0)).then(ok=>{
        if(renderer.current===current&&previousURL.current===url&&!viewer.isDestroyed()){
          if(ok)viewer.trackedEntity=entity;
          report(ok?"Drag to rotate · Scroll to zoom":"Model could not be framed.");
        }
      }).catch(error=>{if(renderer.current===current&&previousURL.current===url)report(`Model could not load: ${error.message}`);});
    }
  },[ready,cesiumBaseUrl,config.preset,config.url,config.scale,config.headingOffset,config.pitchOffset,config.rollOffset,assetBaseUrl]);
  return <><div className="uav3d-preview" aria-label="Interactive model preview"><div className="uav3d-preview-canvas" ref={host}/><button type="button" onClick={reset}>Reset view</button></div><div className="uav3d-preview-status" role="status">{status}</div></>;
}

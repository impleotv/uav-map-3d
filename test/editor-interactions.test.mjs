import test from "node:test";
import assert from "node:assert/strict";
import {JSDOM} from "jsdom";
import React, {act} from "react";
import {createServer} from "vite";
import {resolvePresentation} from "../dist/models.mjs";

test("shared editors retain tab drafts, validate hidden fields and own preview lifetime",async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:"http://localhost"});
  for(const key of ["window","document","HTMLElement","HTMLInputElement","Event","MouseEvent","KeyboardEvent"])globalThis[key]=dom.window[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.previewLifecycle={mounts:0,unmounts:0};
  const {createRoot}=await import("react-dom/client");
  const root=createRoot(document.getElementById("root"));
  const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom",plugins:[{
    name:"preview-lifecycle-fixture",enforce:"pre",load(id){
      if(id.replaceAll("\\","/").endsWith("/dist/react/ModelPreview.js"))return 'import React,{useEffect} from "react";export default function Preview(){useEffect(()=>{globalThis.previewLifecycle.mounts++;return()=>{globalThis.previewLifecycle.unmounts++;};},[]);return React.createElement("div",{"data-preview":true},"Preview");}';
    }
  }]});
  const render=async element=>{await act(async()=>{root.render(element);});};
  const click=async element=>{assert.ok(element);await act(async()=>element.click());};
  const button=text=>[...document.querySelectorAll("button")].find(node=>node.textContent===text);
  const input=async(node,value)=>{await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(node,value);
    node.dispatchEvent(new Event("input",{bubbles:true}));
  });};
  try {
    const {PresentationEditor,PresentationPanel,SceneConfigEditor}=await server.ssrLoadModule("/dist/react/index.js");
    let value=resolvePresentation(),busy=false,saveCount=0,resetCount=0;
    const view=()=>React.createElement(PresentationPanel,{choices:[{key:"a",label:"A"}],selectedKey:"a",onSelect(){},onSave:()=>saveCount++,onReset:()=>resetCount++,onClose(){},saveDisabled:!!value.frustum?.rays&&value.frustum.rays.width===""},React.createElement(PresentationEditor,{value,onChange:next=>{value=next;root.render(view());},busy,assetBaseUrl:"http://localhost/scene/",cesiumBaseUrl:"http://localhost/cesium/"}));
    await render(view());
    // Allow the lazy module to finish without relying on a renderer or network.
    for(let i=0;i<20&&!document.querySelector("[data-preview]");i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    assert.equal(globalThis.previewLifecycle.mounts,1);
    assert.deepEqual([...document.querySelectorAll('[role="tab"]')].map(node=>node.textContent),["Model","VMTI","Frustum"]);
    await click(button("VMTI"));
    assert.equal(globalThis.previewLifecycle.unmounts,1);
    assert.equal(document.querySelector("[data-preview]"),null);
    await click(document.querySelector('#'+CSSescape(document.querySelector('[role="tab"][aria-selected="true"]').getAttribute('aria-controls'))+' input'));
    assert.equal(value.showVmtiTargets,false);
    await click(button("Frustum"));
    assert.deepEqual([...document.querySelectorAll('[role="tabpanel"]:not([hidden]) summary')].map(node=>node.textContent),["Footprint","Aircraft-to-ground lines"]);
    const details=document.querySelector('[role="tabpanel"]:not([hidden]) details');
    await click(details.querySelector("summary"));assert.equal(details.open,false);
    await input(document.querySelector('[aria-label="Aircraft-to-ground lines thickness"]'),"");
    assert.equal(value.frustum.rays.width,"");
    await click(button("VMTI"));
    assert.match(document.querySelector('[role="alert"]').textContent,/thickness/);
    assert.equal(button("Save").disabled,true);
    await click(button("Frustum"));
    assert.equal(details.open,false,"section state survives tab switches");
    await click(button("Reset frustum appearance"));
    assert.equal(value.frustum.rays.width,1);assert.equal(value.showVmtiTargets,false);
    await click(button("Save"));assert.equal(saveCount,1);
    await click(button("Use source settings"));assert.equal(resetCount,1);
    await act(async()=>button("Frustum").dispatchEvent(new KeyboardEvent("keydown",{key:"Home",bubbles:true})));
    assert.equal(button("Model").getAttribute("aria-selected"),"true");
    assert.equal(document.activeElement,button("Model"));
    busy=true;await render(view());
    assert.ok([...document.querySelectorAll("fieldset")].every(fieldset=>fieldset.disabled));

    let config={imageryMode:"bing",ion:{accessToken:"token",bingAerial:true,worldTerrain:true}},saved;
    const map=()=>React.createElement(SceneConfigEditor,{value:config,onChange:next=>{config=next;root.render(map());},assets:[{id:"terrain",kind:"terrain",name:"Local terrain"}],onSave:()=>{saved=config;},onCancel(){},onRegisterFolder:async()=>{throw new Error("Folder unavailable");}});
    await render(map());
    assert.ok(document.querySelector('option[value="bing"]'));
    await click(document.querySelector('[aria-label="Remove Cesium ion token"]'));
    await click(button("Confirm removal"));
    assert.equal(config.ion.accessToken,"");assert.equal(config.imageryMode,"satellite");assert.equal(saved,undefined);
    assert.equal(document.querySelector('option[value="bing"]'),null);
    await input(document.querySelector('input[type="password"]'),"replacement-token");
    assert.ok(document.querySelector('option[value="bing"]'));
    config={...config,imageryMode:"bing",ion:{...config.ion,bingAerial:true}};await render(map());
    await input(document.querySelector('input[type="password"]'),"   ");
    assert.equal(config.imageryMode,"satellite");assert.equal(config.ion.bingAerial,false);
    assert.equal(document.querySelector('option[value="bing"]'),null);
    await click(button("Save"));assert.equal(saved,config);
    await input(document.querySelector('input[placeholder="Absolute path on this computer"]'),"C:/tiles");
    await click(button("Register folder"));
    assert.match(document.querySelector('[role="alert"]').textContent,/Folder unavailable/);
    assert.equal(button("Save").disabled,false,"failed registration releases busy state");
  } finally {
    await act(async()=>root.unmount());await server.close();dom.window.close();
    delete globalThis.previewLifecycle;
  }
});

function CSSescape(value){return value.replace(/[^a-zA-Z0-9_-]/g,char=>`\\${char}`);}

import assert from "node:assert/strict";
import test from "node:test";
import {Cartesian3,Cartographic,EntityCollection,EllipsoidTerrainProvider,PerspectiveFrustum} from "cesium";
import {Scene} from "../dist/index.js";
import {normalizeFrustumStyle} from "../dist/frustumStyle.mjs";

for(const name of ["HTMLCanvasElement","HTMLImageElement","ImageBitmap","OffscreenCanvas"])globalThis[name]??=class {};

test("frame center latitude and longitude draw a styled line without footprint corners",()=>{
  const entities=new EntityCollection();
  const scene=Object.create(Scene.prototype);
  Object.assign(scene,{platforms:new Map(),selected:null,mode:"orbit",destroyed:false,initialFramed:false,
    geoid:()=>0,modelChecks:new Map(),frustumStyle:normalizeFrustumStyle(),options:{assetBaseUrl:"http://localhost/scene/"},
    viewer:{entities,terrainProvider:new EllipsoidTerrainProvider(),canvas:{clientWidth:1000,clientHeight:700},resize(){},
      scene:{requestRender(){},globe:{getHeight:()=>150,pick:()=>undefined},screenSpaceCameraController:{}},
      camera:{frustum:new PerspectiveFrustum(),cancelFlight(){},lookAtTransform(){},setView(){},flyToBoundingSphere(){}}}});
  const platform={id:"p",sourceId:"s",name:"P",timestamp:null,
    position:{latitude:32,longitude:34,height:1000},attitude:null,sensor:null,fov:null,
    frameCenter:{latitude:32.01,longitude:34.02},frameCorners:null,range:null};
  scene.upsertPlatforms([platform]);
  const ray=entities.getById("p:graphic:line-0");
  assert.ok(ray?.show,"reported frame center creates a line without attitude, FOV or corners");
  assert.equal(scene.platforms.get("p").ground.corners.length,0);
  assert.equal(entities.getById("p:graphic:footprint"),undefined);
  assert.equal(ray.polyline.width.getValue(),1);
  const [origin,endpoint]=ray.polyline.positions.getValue();
  assert.ok(Cartesian3.equals(origin,scene.platforms.get("p").pose.position));
  assert.ok(Math.abs(Cartographic.fromCartesian(endpoint).height-150)<0.001);
  assert.ok(Math.abs(Cartographic.fromCartesian(endpoint).latitude-32.01*Math.PI/180)<1e-8);
  scene.configureModel("p",{preset:"uav",scale:1,frustum:{rays:{color:"#123456",width:5,opacity:0.7}}});
  assert.equal(ray.polyline.width.getValue(),5);
  assert.equal(ray.polyline.material.color.getValue().toCssColorString(),"rgba(18,52,86,0.7)");
  scene.upsertPlatforms([{...platform,frameCenter:null}]);
  assert.equal(ray.show,false,"missing center and corners clear the line");
  scene.upsertPlatforms([platform]);
  assert.equal(ray.show,true);
  scene.removePlatform("p");
  assert.equal(entities.getById("p:graphic:line-0"),undefined);
});

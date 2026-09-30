import assert from "node:assert/strict";
import test from "node:test";
import {Cartesian3,Cartographic,EntityCollection,EllipsoidTerrainProvider,PerspectiveFrustum,PolylineDashMaterialProperty} from "cesium";
import {Scene} from "../dist/index.js";
import {normalizeFrustumStyle} from "../dist/frustumStyle.mjs";
import {sceneBounds} from "../dist/framing.mjs";

for(const name of ["HTMLCanvasElement","HTMLImageElement","ImageBitmap","OffscreenCanvas"])globalThis[name]??=class {};

test("reported target renders independently, follows the platform, and cleans up",()=>{
  let flights=0,renders=0,terrainHeight=150;
  const scene=Object.create(Scene.prototype);
  Object.assign(scene,{platforms:new Map(),selected:null,mode:"orbit",destroyed:false,initialFramed:false,
    geoid:()=>25,modelChecks:new Map(),frustumStyle:normalizeFrustumStyle(),options:{assetBaseUrl:"http://localhost/scene/"},
    viewer:{entities:new EntityCollection(),terrainProvider:new EllipsoidTerrainProvider(),canvas:{clientWidth:1000,clientHeight:700},resize(){},
      scene:{requestRender(){renders++;},globe:{getHeight:()=>terrainHeight,pick:()=>undefined},screenSpaceCameraController:{}},
      camera:{frustum:new PerspectiveFrustum(),cancelFlight(){},lookAtTransform(){},setView(){},flyToBoundingSphere(){flights++;}}}});
  const base={id:"a",sourceId:"s",name:"Aircraft",timestamp:null,position:null,attitude:null,sensor:null,fov:null,frameCenter:null,range:null};
  const location={latitude:32,longitude:34,height:100,reference:"msl"};
  scene.upsertPlatforms([{...base,targetLocation:location}]);
  const entities=scene.viewer.entities;
  const marker=entities.getById("a:graphic:target-crosshair");
  assert.ok(marker.show);
  assert.equal(flights,1,"target-only metadata is framed");
  assert.ok(Math.abs(Cartographic.fromCartesian(marker.position.getValue()).height-125)<0.001);
  assert.equal(marker.billboard.width.getValue(),24);
  assert.match(decodeURIComponent(marker.billboard.image.getValue()),/stroke="#ff0000"/);
  assert.equal(entities.getById("a:graphic:target-line"),undefined);
  assert.ok(sceneBounds(scene.platforms.values()));
  const rendersBeforeHide=renders;
  scene.configureModel("a",{preset:"uav",scale:1,showTarget:false});
  assert.equal(marker.show,false);
  assert.ok(renders>rendersBeforeHide,"target-only visibility changes request a frame");
  assert.equal(sceneBounds(scene.platforms.values()),undefined,"hidden target-only metadata is excluded from framing");
  scene.configureModel("a",{preset:"uav",scale:1,showTarget:true});
  assert.equal(marker.show,true);

  const position={latitude:32,longitude:34.01,height:1000};
  scene.upsertPlatforms([{...base,position,targetLocation:location}]);
  const line=entities.getById("a:graphic:target-line");
  assert.ok(line.show);
  assert.ok(line.polyline.material instanceof PolylineDashMaterialProperty);
  assert.equal(line.polyline.width.getValue(),2);
  assert.ok(Cartesian3.equals(line.polyline.positions.getValue()[1],marker.position.getValue()));
  scene.upsertPlatforms([{...base,position:{...position,longitude:34.2},targetLocation:location}]);
  assert.ok(Cartesian3.equals(line.polyline.positions.getValue()[0],scene.platforms.get("a").pose.position));
  scene.configureModel("a",{preset:"uav",scale:1,showTarget:false});
  assert.equal(marker.show,false);assert.equal(line.show,false);
  scene.configureModel("a",{preset:"uav",scale:1,showTarget:true,targetStyle:{color:"#123456",width:5,crosshairSize:40}});
  assert.equal(marker.show,true);assert.equal(line.show,true);
  assert.equal(marker.billboard.width.getValue(),40);
  assert.equal(line.polyline.width.getValue(),5);
  assert.equal(line.polyline.material.color.getValue().toCssColorString(),"rgb(18,52,86)");
  scene.configureModel("a",{preset:"uav",scale:1,visible:false});
  assert.equal(marker.show,false);assert.equal(line.show,false);
  scene.configureModel("a",{preset:"uav",scale:1,visible:true});
  assert.equal(marker.show,true);assert.equal(line.show,true);
  assert.throws(()=>scene.configureModel("a",{preset:"uav",scale:1,targetStyle:{width:0}}));
  assert.equal(line.show,true,"invalid settings leave current graphics intact");

  scene.upsertPlatforms([{...base,position,targetLocation:{latitude:32,longitude:34}}]);
  assert.ok(Math.abs(Cartographic.fromCartesian(marker.position.getValue()).height-(terrainHeight+0.5))<0.001);
  terrainHeight=200;scene.render(scene.platforms.get("a"));
  assert.ok(Math.abs(Cartographic.fromCartesian(marker.position.getValue()).height-200.5)<0.001);
  scene.geoid=null;scene.upsertPlatforms([{...base,position,targetLocation:location}]);
  assert.equal(marker.show,false,"reported MSL height waits for the geoid instead of using a false altitude");
  scene.geoid=()=>25;scene.render(scene.platforms.get("a"));
  assert.equal(marker.show,true);
  scene.upsertPlatforms([{...base,position,targetLocation:{latitude:91,longitude:34}}]);
  assert.equal(marker.show,false);assert.equal(line.show,false);
  scene.upsertPlatforms([{...base,position,targetLocation:location,stale:true}]);
  assert.equal(marker.show,false);assert.equal(line.show,false);
  scene.upsertPlatforms([{...base,position,targetLocation:null}]);
  assert.equal(marker.show,false);assert.equal(line.show,false);
  scene.removePlatform("a");
  assert.equal(entities.getById("a:graphic:target-crosshair"),undefined);
  assert.equal(entities.getById("a:graphic:target-line"),undefined);
  assert.ok(renders>0);
});

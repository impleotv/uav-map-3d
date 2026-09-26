import assert from "node:assert/strict";
import test from "node:test";
import {Event, Ion, IonResource, IonImageryProvider, CesiumTerrainProvider, Cesium3DTileset, EllipsoidTerrainProvider} from "cesium";
import {Scene} from "../dist/index.js";

function fixture() {
  const scene=Object.create(Scene.prototype), errors=[], layers=[], primitives=[];
  Object.assign(scene,{destroyed:false,mapGeneration:0,platforms:new Map(),options:{onError:message=>errors.push(message)},
    viewer:{imageryLayers:{removeAll(){layers.length=0;},addImageryProvider(p){layers.push(p);}},
      scene:{globe:{show:true},requestRender(){},primitives:{add(p){primitives.push(p);return p;},remove(p){primitives.splice(primitives.indexOf(p),1);p.destroy();}}}}});
  return {scene,errors,layers,primitives};
}
const ion={accessToken:"test-token",worldTerrain:true,osmBuildings:true,bingAerial:true};
const tileset=()=>({tileFailed:new Event(),destroyed:false,destroy(){this.destroyed=true;}});

test("online assets use per-scene credentials, and offline removes buildings",async t=>{
  const {scene,layers,primitives}=fixture(), ids=[], building=tileset(), globalToken=Ion.defaultAccessToken;
  t.mock.method(IonResource,"fromAssetId",async(id,options)=>{ids.push(id);assert.equal(options.accessToken,ion.accessToken);return `asset-${id}`;});
  t.mock.method(CesiumTerrainProvider,"fromUrl",async()=>({errorEvent:new Event()}));
  t.mock.method(Cesium3DTileset,"fromUrl",async()=>building);
  const imagery=t.mock.method(IonImageryProvider,"fromAssetId",async(id,options)=>{assert.equal(id,2);assert.equal(options.accessToken,ion.accessToken);return {errorEvent:new Event()};});
  await scene.configureMap({ion});
  assert.deepEqual(ids.sort((a,b)=>a-b),[1,96188]);assert.equal(layers.length,1);assert.equal(primitives.length,1);
  assert.equal(Ion.defaultAccessToken,globalToken);
  await scene.configureMap({offline:true,ion});
  assert.equal(ids.length,2);assert.equal(imagery.mock.callCount(),1);
  assert.equal(layers.length,0);assert.equal(primitives.length,0);assert.equal(building.destroyed,true);
  assert.ok(scene.viewer.terrainProvider instanceof EllipsoidTerrainProvider);
});

test("defaults and missing tokens make no ion requests; explicit terrain wins",async t=>{
  const {scene,errors}=fixture();
  const resource=t.mock.method(IonResource,"fromAssetId",async()=>{throw Error("unexpected");});
  const imagery=t.mock.method(IonImageryProvider,"fromAssetId",async()=>{throw Error("unexpected");});
  const terrain=t.mock.method(CesiumTerrainProvider,"fromUrl",async url=>{assert.equal(url,"local-terrain");return {errorEvent:new Event()};});
  await scene.configureMap({});
  await scene.configureMap({ion:{...ion,accessToken:" "}});
  await scene.configureMap({terrainUrl:"local-terrain",ion:{accessToken:"test",worldTerrain:true}});
  assert.equal(resource.mock.callCount(),0);assert.equal(imagery.mock.callCount(),0);
  assert.equal(terrain.mock.callCount(),1);assert.equal(errors.length,1);
});

test("late building loads are destroyed after replacement or scene destruction",async t=>{
  t.mock.method(IonResource,"fromAssetId",async()=>"buildings");
  for(const destroy of [false,true]) {
    const {scene,primitives}=fixture(),building=tileset();let resolve,started;
    const ready=new Promise(r=>{started=r;});
    t.mock.method(Cesium3DTileset,"fromUrl",()=>{started();return new Promise(r=>{resolve=r;});});
    const pending=scene.configureMap({ion:{accessToken:"test",osmBuildings:true}});
    await ready;
    if(destroy)scene.destroyed=true;else await scene.configureMap({offline:true});
    resolve(building);await pending;
    assert.equal(building.destroyed,true);assert.equal(primitives.length,0);
  }
});

test("one service failure preserves other layers and never exposes token errors",async t=>{
  const {scene,errors,layers}=fixture();
  t.mock.method(IonResource,"fromAssetId",async()=>{throw Error("secret-token-in-url");});
  t.mock.method(IonImageryProvider,"fromAssetId",async()=>({errorEvent:new Event()}));
  await scene.configureMap({ion});
  assert.equal(errors.length,2);assert.equal(layers.length,1);
  assert.ok(errors.every(message=>!message.includes("secret-token")));
});

test("Google uses the supplied token, hides duplicate surfaces and restores the map",async t=>{
  const {scene,primitives}=fixture(), google=tileset(), osm=tileset(), ids=[];
  t.mock.method(IonResource,"fromAssetId",async(id,options)=>{ids.push(id);assert.equal(options.accessToken,"google-token");return id;});
  t.mock.method(Cesium3DTileset,"fromUrl",async(id,options)=>{
    if(id===2275207){assert.equal(options.enableCollision,true);return google;}
    return osm;
  });
  await scene.configureMap({ion:{accessToken:"google-token",googlePhotorealistic:true,osmBuildings:true}});
  assert.ok(ids.includes(2275207));assert.equal(primitives.length,2);
  assert.equal(scene.viewer.scene.globe.show,false);assert.equal(osm.show,false);
  await scene.configureMap({offline:true,ion:{accessToken:"google-token",googlePhotorealistic:true}});
  assert.equal(ids.length,2);assert.equal(google.destroyed,true);assert.equal(osm.destroyed,true);
  assert.equal(scene.viewer.scene.globe.show,true);assert.equal(primitives.length,0);
});

test("Google missing tokens and failed loads preserve the globe",async t=>{
  const {scene,errors}=fixture();
  const resource=t.mock.method(IonResource,"fromAssetId",async()=>{throw Error("sensitive-url");});
  await scene.configureMap({ion:{accessToken:"",googlePhotorealistic:true}});
  assert.equal(resource.mock.callCount(),0);assert.equal(errors.length,1);
  await scene.configureMap({ion:{accessToken:"bad-token",googlePhotorealistic:true}});
  assert.equal(scene.viewer.scene.globe.show,true);
  assert.match(errors.at(-1),/Google Photorealistic/);assert.ok(!errors.at(-1).includes("sensitive-url"));
});

test("late Google loads cannot hide a replacement map or leak a tileset",async t=>{
  t.mock.method(IonResource,"fromAssetId",async()=>"google");
  for(const destroy of [false,true]) {
    const {scene,primitives}=fixture(),google=tileset();let resolve,started;
    const ready=new Promise(r=>{started=r;});
    t.mock.method(Cesium3DTileset,"fromUrl",()=>{started();return new Promise(r=>{resolve=r;});});
    const pending=scene.configureMap({ion:{accessToken:"test",googlePhotorealistic:true}});
    await ready;
    if(destroy)scene.destroyed=true;else await scene.configureMap({});
    resolve(google);await pending;
    assert.equal(google.destroyed,true);assert.equal(primitives.length,0);assert.equal(scene.viewer.scene.globe.show,true);
  }
});

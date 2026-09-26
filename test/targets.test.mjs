import assert from "node:assert/strict";
import test from "node:test";
import {Cartesian3,Cartographic,Matrix4,Transforms,PrimitiveCollection,Ellipsoid,EntityCollection,EllipsoidTerrainProvider,PerspectiveFrustum} from "cesium";
import {Scene} from "../dist/index.js";
import {footprintProjection,placeTarget,targetSurfacePoints} from "../dist/targetGeometry.mjs";
import {TargetLayer} from "../dist/TargetLayer.mjs";
import {normalizeFrustumStyle} from "../dist/frustumStyle.mjs";

// Cesium checks browser image classes even for plain color uniforms; no WebGL
// or image loading is used by these collection lifecycle tests.
for(const name of ["HTMLCanvasElement","HTMLImageElement","ImageBitmap","OffscreenCanvas"])globalThis[name]??=class {};

const transform=Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(179.9999,32));
const world=(x,y)=>Matrix4.multiplyByPoint(transform,new Cartesian3(x,y,0),new Cartesian3());
const corners=[world(-100,100),world(200,150),world(100,-100),world(-75,-100)];
const surface=p=>Ellipsoid.WGS84.scaleToGeodeticSurface(p,new Cartesian3());

test("perspective mapping reproduces corners and an independently known oblique camera",()=>{
  const mapping=footprintProjection(corners);
  assert.ok(mapping);
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{
    const local=mapping.toLocal(corners[i]),actual=mapping.xy(u,v);
    assert.ok(Math.hypot(local.x-actual.x,local.y-actual.y)<1e-6);
  });
  // Pinhole camera at (0,0,1000), with forward=(0,1,-1), right=X,
  // up=(0,1,1). Intersection has a rational denominator, not bilinear UV.
  const rayHit=(u,v)=>{
    const x=(2*u-1)*0.3,y=(1-2*v)*0.2;
    const ry=(1+y)/Math.sqrt(2),rz=(-1+y)/Math.sqrt(2);
    return world(-1000*x/rz,-1000*ry/rz);
  };
  const perspective=footprintProjection([[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>rayHit(u,v)));
  const p=perspective.toWorld(perspective.xy(0.3,0.6));
  // Local ground plane and geodetic tangent plane differ slightly over 1 km.
  assert.ok(Cartesian3.distance(p,rayHit(0.3,0.6))<0.3);
  assert.equal(footprintProjection([corners[0],corners[2],corners[1],corners[3]]),null);
  assert.equal(footprintProjection([corners[0],corners[0],corners[2],corners[3]]),null);
  assert.equal(footprintProjection([corners[0],null,corners[2],corners[3]]),null);
});

test("reported center anchors an estimated box; surface lines stay closed",()=>{
  const mapping=footprintProjection(corners),target={box:{left:0,top:0,right:1,bottom:1},center:{latitude:32,longitude:-179.999}};
  const placement=placeTarget(target,mapping);
  assert.equal(placement.estimated,true);
  const projectedCenter=mapping.toLocal(Cartesian3.fromDegrees(target.center.longitude,target.center.latitude));
  const uvCenter=mapping.xy(0.5,0.5),uvCorner=mapping.xy(0,0),actual=mapping.toLocal(placement.points[0]);
  assert.ok(Math.abs(actual.x-(uvCorner.x+projectedCenter.x-uvCenter.x))<1e-6);
  const points=targetSurfacePoints(placement,surface);
  assert.equal(points.length,17);assert.equal(points[0],points.at(-1));
  assert.ok(Math.abs(Cartographic.fromCartesian(points[0]).height-0.5)<1e-4);
  assert.equal(placeTarget(target,null).closed,false,"center survives unavailable footprint");
  assert.equal(placeTarget({box:target.box},null),null);
});

test("target primitives reuse bounded slots, honor visibility and release all resources",()=>{
  const primitives=new PrimitiveCollection();let requests=0,projections=0;
  const viewer={scene:{primitives,requestRender(){requests++;}}};
  const layer=new TargetLayer(viewer),project=p=>{projections++;return surface(p);};
  const frame=(prefix,count)=>({key:prefix,targets:Array.from({length:count},(_,i)=>({id:`${prefix}-${i}`,box:{left:0.1,top:0.1,right:0.2,bottom:0.2}}))});
  for(let i=0;i<20;i++)layer.upsert("stream:258","A","1",frame(String(i),500),corners,project);
  assert.equal(layer.stats.active,500);assert.equal(layer.stats.allocated,500);
  layer.upsert("other:258","B","1",frame("other",1),corners,project);
  assert.equal(layer.stats.active,501);
  layer.configure({visible:false});const before=projections;
  layer.tick(0.1,()=>null);assert.equal(projections,before);assert.equal(layer.lines.show,false);
  layer.configure({visible:true});assert.ok(projections>before);
  const oldLine=layer.items.values().next().value.line;
  layer.upsert("stream:258","A","2",frame("reset",1),corners,project);
  assert.equal(layer.stats.active,2);assert.ok(!oldLine.show||oldLine.id.targetId==="reset-0");
  layer.remove("stream:258");layer.remove("other:258");
  assert.equal(layer.stats.allocated,0);assert.equal(layer.lines.length,0);
  layer.destroy();assert.equal(primitives.length,0);assert.ok(requests>0);
});

test("Scene renders ground-only metadata, rejects off-earth footprints, and cleans up",async()=>{
  {
    let flights=0;
    const scene=Object.create(Scene.prototype),primitives=new PrimitiveCollection();
    Object.assign(scene,{platforms:new Map(),selected:null,mode:"orbit",destroyed:false,initialFramed:false,
      geoid:()=>0,modelChecks:new Map(),frustumStyle:normalizeFrustumStyle(),options:{assetBaseUrl:"http://localhost/scene/"},
      viewer:{entities:new EntityCollection(),terrainProvider:new EllipsoidTerrainProvider(),canvas:{clientWidth:1000,clientHeight:700},resize(){},
        scene:{primitives,requestRender(){},globe:{getHeight:()=>0,pick:()=>undefined},screenSpaceCameraController:{}},
        camera:{frustum:new PerspectiveFrustum(),cancelFlight(){},lookAtTransform(){},setView(){},flyToBoundingSphere(){flights++;}}}});
    scene.targets=new TargetLayer(scene.viewer);
    const geometry={...{position:null,attitude:null,sensor:null,fov:null,frameCenter:null,frameCorners:null,range:null},frameCorners:[{latitude:32.01,longitude:34},{latitude:32.01,longitude:34.01},{latitude:32,longitude:34.01},{latitude:32,longitude:34}]};
    const targetFrame={key:"1",geometry,targets:[{id:"1",box:{left:0.1,top:0.1,right:0.2,bottom:0.2}}]};
    const platform={...geometry,id:"a:258",sourceId:"a",generation:"1",name:"A",timestamp:null,targetFrame};
    scene.upsertPlatforms([platform]);
    assert.equal(scene.targetStats.active,1,"four reported corners work without aircraft position");
    assert.equal(flights,1,"ground-only detections can be framed");
    const first=scene.targets.items.values().next().value.line.positions[0];
    scene.upsertPlatforms([{...platform,frameCorners:null}]);
    assert.deepEqual(scene.targets.items.values().next().value.line.positions[0],first,"merged platform geometry cannot move detections");
    scene.upsertPlatforms([{...platform,targetFrame:{...targetFrame,key:"2",geometry:{...geometry,frameCornersOffEarth:[true,false,false,false]}}}]);
    assert.equal(scene.targetStats.active,0);
    const geographic={...targetFrame,key:"3",geometry:{position:null,attitude:null,sensor:null,fov:null,frameCenter:null,frameCorners:null,range:null},targets:[{id:"1",center:{latitude:32,longitude:34}}]};
    scene.upsertPlatforms([{...platform,targetFrame:geographic}]);assert.equal(scene.targetStats.active,1);
    scene.configureTargets({visible:false});scene.upsertPlatforms([{...platform,targetFrame:geographic}]);assert.equal(scene.targetStats.active,0);
    scene.configureTargets({visible:true});assert.equal(scene.targetStats.active,1);
    const camera={...{position:null,attitude:null,sensor:null,fov:null,frameCenter:null,frameCorners:null,range:null},position:{latitude:32,longitude:34,height:1000},attitude:{heading:0,pitch:0,roll:0},sensor:{heading:0,pitch:-90,roll:0},fov:{horizontal:35,vertical:25}};
    const estimated={...platform,...camera,targetFrame:{...targetFrame,key:"4",geometry:camera}};
    scene.upsertPlatforms([estimated]);assert.equal(scene.targetStats.active,1,"pose/FOV reconstruct missing corners");
    assert.equal(scene.targets.frames.get(platform.id).shared,true);
    const moved={...camera,position:{...camera.position,longitude:34.01}};
    scene.upsertPlatforms([{...estimated,...moved,generation:"2",targetFrame:{...targetFrame,key:"5",geometry:moved}}]);
    const entry=scene.platforms.get(platform.id);
    assert.ok(Cartesian3.equals(entry.pose.position,entry.position),"seek snaps rather than easing from the old generation");
    scene.removePlatform(platform.id);assert.equal(scene.targetStats.active,0);assert.equal(scene.targetStats.allocated,0);
    scene.targets.destroy();
  }
});

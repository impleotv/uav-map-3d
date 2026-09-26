import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sceneAxes, fovCornerDirections } from "../dist/math.mjs";
import { readGeoidGrid } from "../dist/geoid.mjs";
import {sensorGroundGeometry,groundOutlineSegments} from "../dist/ground.mjs";
import {Cartesian3, Cartographic, Matrix3, Matrix4, Transforms, Ellipsoid, IntersectionTests, Ray} from "cesium";
import {modelOrientation} from "../dist/orientation.mjs";
import ModelUtility from "@cesium/engine/Source/Scene/Model/ModelUtility.js";
import Axis from "@cesium/engine/Source/Scene/Axis.js";
import {defaultFrustumStyle,normalizeFrustumStyle} from "../dist/frustumStyle.mjs";
import {sceneBounds,framingRange} from "../dist/framing.mjs";
import {PerspectiveFrustum} from "cesium";
import {sensorViewPosition,groundReferenceFromRange} from "../dist/sensorView.mjs";

assert.deepEqual(normalizeFrustumStyle(),defaultFrustumStyle);
const customStyle=normalizeFrustumStyle({rays:{color:'#ff8040',width:5.5,opacity:0}});
assert.deepEqual(customStyle.rays,{color:'#ff8040',width:5.5,opacity:0});
assert.deepEqual(customStyle.groundOutline,defaultFrustumStyle.groundOutline);
assert.equal(defaultFrustumStyle.rays.width,1);
for(const patch of [{color:'red'},{color:'#fffffg'},{width:0},{width:11},{width:NaN},{opacity:-0.1},{opacity:1.1}])assert.throws(()=>normalizeFrustumStyle({rays:patch}));

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const vector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
vector(sceneAxes({heading:0,pitch:0,roll:0}).forward,[0,1,0]);
vector(sceneAxes({heading:90,pitch:0,roll:0}).forward,[1,0,0]);
vector(sceneAxes({heading:0,pitch:90,roll:0}).forward,[0,0,1]);
vector(sceneAxes({heading:0,pitch:0,roll:90}).right,[0,0,-1]);
vector(sceneAxes({heading:90,pitch:0,roll:0},{heading:90,pitch:-90,roll:0}).forward,[0,0,-1]);
vector(sceneAxes({heading:0,pitch:0,roll:90},{heading:0,pitch:-90,roll:0}).forward,[-1,0,0]);

// Nadir camera 1 km above a flat plane: independently known rectangular footprint.
const nadir=sceneAxes({heading:0,pitch:0,roll:0},{heading:0,pitch:-90,roll:0});
const corners=fovCornerDirections(nadir,{horizontal:60,vertical:40});
for (const ray of corners) {
  near(Math.hypot(...ray),1);
  const distance=-1000/ray[2];
  near(Math.abs(ray[0]*distance),1000/Math.sqrt(3));
  near(Math.abs(ray[1]*distance),1000*Math.tan(20*Math.PI/180));
}
const rolled=sceneAxes({heading:0,pitch:0,roll:0},{heading:0,pitch:-90,roll:90});
const rolledCorner=fovCornerDirections(rolled,{horizontal:60,vertical:40})[0];
near(Math.abs(rolledCorner[0]*(-1000/rolledCorner[2])),1000*Math.tan(20*Math.PI/180));

const data=readFileSync(new URL("../assets/geoid/egm96_15.gtx",import.meta.url));
const geoid=readGeoidGrid(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
near(geoid(0,-180),geoid(0,180));
near(geoid(45,-90),geoid(45,270));
assert.ok(Math.abs(geoid(0,0)-17.16)<0.1,"EGM96 equatorial reference");
assert.ok(Math.abs(geoid(90,0)-geoid(90,90))<0.01,"north pole continuity");
assert.throws(()=>readGeoidGrid(new ArrayBuffer(8)));

// First KLV packet (PID 258, PTS 120.221056) of D:/Movie/ArcGIS/Truck.ts.
// The target lies at 1867 m MSL: intersecting the sea-level globe overshoots it.
const truck=JSON.parse(readFileSync(new URL("./fixtures/truck.json",import.meta.url)));
// Verify the actual Cesium loader conversion, not only our NED math. glTF
// preset anatomical axes are nose +X, right +Z, up +Y. The old entity rotation
// applied heading to +X after Cesium had already moved the nose to +Y.
const correction=Matrix4.getMatrix3(ModelUtility.getAxisCorrectionMatrix(Axis.Y,Axis.Z,new Matrix4()),new Matrix3());
const testPosition=Cartesian3.fromDegrees(-104.87,41.09,2900);
const inverseEnu=Matrix3.transpose(Matrix4.getMatrix3(Transforms.eastNorthUpToFixedFrame(testPosition),new Matrix3()),new Matrix3());
const transformedModelAxes=(attitude,alignment={heading:0,pitch:0,roll:0})=>{
  const rotation=Matrix3.fromQuaternion(modelOrientation(testPosition,attitude,alignment));
  const combined=Matrix3.multiply(inverseEnu,Matrix3.multiply(rotation,correction,new Matrix3()),new Matrix3());
  return [Cartesian3.UNIT_X,Cartesian3.UNIT_Z,Cartesian3.UNIT_Y].map(v=>{
    const p=Matrix3.multiplyByVector(combined,v,new Cartesian3());return [p.x,p.y,p.z];
  });
};
for(const heading of [0,90,180,270]) {
  const [nose,right,up]=transformedModelAxes({heading,pitch:0,roll:0});
  const h=heading*Math.PI/180;
  vector(nose,[Math.sin(h),Math.cos(h),0]);
  vector(right,[Math.cos(h),-Math.sin(h),0]);vector(up,[0,0,1]);
}
const [pitchedNose]=transformedModelAxes({heading:0,pitch:20,roll:0});
near(pitchedNose[2],Math.sin(20*Math.PI/180));
const [,bankedWing]=transformedModelAxes({heading:0,pitch:0,roll:30});
near(bankedWing[2],-0.5);
const [truckNose,truckRight]=transformedModelAxes(truck.attitude);
near((Math.atan2(truckNose[0],truckNose[1])*180/Math.PI+360)%360,truck.attitude.heading);
near(Math.asin(truckNose[2])*180/Math.PI,truck.attitude.pitch);
near(Math.asin(-truckRight[2]/Math.cos(truck.attitude.pitch*Math.PI/180))*180/Math.PI,truck.attitude.roll);
const [alignedNose]=transformedModelAxes({heading:0,pitch:0,roll:0},{heading:90,pitch:0,roll:0});
vector(alignedNose,[1,0,0]);
const world=p=>Cartesian3.fromDegrees(p.longitude,p.latitude,p.height+(p.reference==='msl'?geoid(p.latitude,p.longitude):0));
const project=p=>{const c=Cartographic.fromCartesian(p);return Cartesian3.fromRadians(c.longitude,c.latitude,0);};
// First PID 497 packet of the user's Dead Sea recording: signed altitude,
// target lat/lon and range are present, target elevation and sensor roll absent.
const deadSea=JSON.parse(readFileSync(new URL("./fixtures/deadsea.json",import.meta.url)));
assert.ok(deadSea.position.height<0);
assert.equal(deadSea.position.reference,'msl');
assert.equal(deadSea.frameCenter.height,undefined,'absent elevation is not invented');
assert.equal(deadSea.sensor,null,'missing roll does not imply complete sensor orientation');
assert.equal(deadSea.frameCorners.length,4,'reported corners remain available without altitude');
const seaOrigin=world(deadSea.position);
const seaTarget=Cartesian3.fromDegrees(deadSea.frameCenter.longitude,deadSea.frameCenter.latitude,0);
const seaReference=groundReferenceFromRange(seaOrigin,seaTarget,deadSea.range);
assert.ok(Cartographic.fromCartesian(seaReference).height<Cartographic.fromCartesian(seaOrigin).height);
near(Cartesian3.distance(seaOrigin,seaReference),deadSea.range);
const seaDisplay=sensorViewPosition({origin:seaOrigin,frameCenter:seaReference,ellipsoidGround:true,project});
assert.ok(Cartographic.fromCartesian(seaDisplay.position).height>5&&Cartographic.fromCartesian(seaDisplay.position).height<100,'negative MSL platform is visible above flat-map ground');
assert.equal(groundReferenceFromRange(seaOrigin,seaTarget,1),undefined,'inconsistent range is not used to invent ground height');
assert.equal(groundReferenceFromRange(seaOrigin,seaTarget,null),undefined);
const seaCorners=deadSea.frameCorners.map(p=>Cartesian3.fromDegrees(p.longitude,p.latitude,0));
const seaGround=sensorGroundGeometry({origin:seaOrigin,frameCenterSurface:seaTarget,frameCornerSurfaces:seaCorners,ellipsoidGround:true,project});
assert.deepEqual(seaGround.center,seaTarget);
assert.equal(seaGround.corners.length,4);
const origin=world(truck.position), center=world(truck.frameCenter);
const localAxes=sceneAxes(truck.attitude,truck.sensor);
const transform=Transforms.eastNorthUpToFixedFrame(origin);
const axes=Object.fromEntries(Object.entries(localAxes).map(([key,v])=>[key,Matrix4.multiplyByPointAsVector(transform,new Cartesian3(...v),new Cartesian3())]));
const intersect=direction=>{const ray=new Ray(origin,direction),interval=IntersectionTests.rayEllipsoid(ray,Ellipsoid.WGS84);return interval&&Ray.getPoint(ray,interval.start);};
assert.ok(Cartesian3.distance(project(center),intersect(axes.forward))>3000,'old ellipsoid intersection misses by kilometres');
const input={origin,axes,fov:truck.fov,frameCenter:center,frameCorners:truck.frameCorners.map(world),range:truck.range,ellipsoidGround:true,intersect,project};
const footprint=sensorGroundGeometry(input);
const offEarthGround=sensorGroundGeometry({...input,frameCenterOffEarth:true,frameCornersOffEarth:[true,true,true,true]});
assert.equal(offEarthGround.center,undefined);
assert.deepEqual(offEarthGround.corners,[],"off-earth endpoints cannot use reported geometry or FOV reconstruction");
const partialGround=sensorGroundGeometry({...input,frameCornersOffEarth:[true,false,false,false]});
assert.equal(partialGround.corners[0],undefined);
assert.ok(partialGround.center);
assert.ok(partialGround.corners.slice(1).every(Boolean));
assert.deepEqual(groundOutlineSegments(partialGround.corners),[
  [partialGround.corners[1],partialGround.corners[2]],[partialGround.corners[2],partialGround.corners[3]]
]);
assert.deepEqual(groundOutlineSegments([undefined,center,undefined,origin]),[],"opposite corners must not be joined");
assert.deepEqual(groundOutlineSegments([center,undefined,undefined,origin]),[[origin,center]],"last and first corners are adjacent");
const estimatedPartial=sensorGroundGeometry({...input,frameCorners:undefined,frameCornersOffEarth:[false,true,false,false]});
assert.equal(estimatedPartial.corners[1],undefined,"FOV cannot reconstruct an off-earth corner");
assert.ok(estimatedPartial.corners[0]);
assert.ok(Cartesian3.distance(footprint.center,project(center))<0.001);
assert.equal(footprint.corners.length,4);
footprint.corners.forEach((corner,i)=>assert.ok(Cartesian3.distance(corner,project(world(truck.frameCorners[i])))<0.001));
assert.match(footprint.status,/Reported metadata footprint/);
// With no reported corners, use the target elevation, not sea level.
const calculated=sensorGroundGeometry({...input,frameCorners:undefined});
assert.equal(calculated.corners.filter(Boolean).length,4);
assert.ok(Cartesian3.distance(calculated.corners[0],project(center))<200);
// Slant-range fallback also terminates near the actual target.
const ranged=sensorGroundGeometry({...input,frameCenter:undefined,frameCorners:undefined});
assert.ok(Cartesian3.distance(ranged.center,project(center))<30);
// Reported positions never manufacture a fully oriented sensor camera.
const centerOnly=sensorGroundGeometry({...input,axes:undefined,frameCorners:undefined});
assert.equal(centerOnly.corners.length,0);
assert.ok(Cartesian3.distance(centerOnly.center,project(center))<0.001);
const actualTerrain=sensorGroundGeometry({...input,frameCenter:undefined,frameCorners:undefined,ellipsoidGround:false,intersect:()=>center});
assert.ok(Cartesian3.distance(actualTerrain.center,center)<0.001,'configured terrain retains its intersection');
const corrected=sensorViewPosition({origin,direction:axes.forward,frameCenter:center,range:truck.range,ellipsoidGround:true,project});
assert.equal(corrected.approximate,true);
const sensorRay=new Ray(corrected.position,axes.forward);
const sensorHit=Ray.getPoint(sensorRay,IntersectionTests.rayEllipsoid(sensorRay,Ellipsoid.WGS84).start);
assert.ok(Cartesian3.distance(sensorHit,project(center))<30,'sensor camera looks at the displayed Truck target instead of overshooting by kilometres');
const toTarget=Cartesian3.subtract(project(center),corrected.position,new Cartesian3());
const depth=Cartesian3.dot(toTarget,axes.forward);
assert.ok(depth>0);
assert.ok(Math.abs(Cartesian3.dot(toTarget,axes.right)/depth)<Math.tan(truck.fov.horizontal*Math.PI/360),'reported target is inside horizontal sensor FOV');
assert.ok(Math.abs(Cartesian3.dot(toTarget,axes.up)/depth)<Math.tan(truck.fov.vertical*Math.PI/360),'reported target is inside vertical sensor FOV');
assert.equal(sensorViewPosition({origin,direction:axes.forward,frameCenter:center,ellipsoidGround:false,project}).position,origin,'terrain mode uses actual sensor position');
assert.equal(sensorViewPosition({origin,direction:axes.forward,ellipsoidGround:true,project}).position,origin,'missing target reference does not fabricate a correction');
assert.equal(sensorViewPosition({origin,direction:axes.forward,range:truck.range,ellipsoidGround:true,project}).approximate,true,'slant range can supply the reference elevation');
// Fit all must include the Truck's ground footprint, not just its origin.
const truckEntry={config:{visible:true},position:origin,lines:[[origin,footprint.center]],footprint:footprint.corners};
const otherPosition=Cartesian3.fromDegrees(-104.95,41.12,4000);
const otherEntry={config:{},position:otherPosition,lines:[]};
const hiddenEntry={config:{visible:false},position:Cartesian3.fromDegrees(0,0,0),lines:[]};
const bounds=sceneBounds([truckEntry,otherEntry,hiddenEntry,{config:{},lines:[]}]);
for(const point of [origin,footprint.center,...footprint.corners,otherPosition]) {
  assert.ok(Cartesian3.distance(point,bounds.center)<=bounds.radius+1e-6,'all visible geometry is bounded');
}
assert.deepEqual(bounds,sceneBounds([truckEntry,otherEntry]),'hidden platforms do not change framing');
assert.equal(sceneBounds([hiddenEntry]),undefined);
const single=sceneBounds([{config:{},position:origin,lines:[]}]);
assert.equal(single.radius,0);
for(const [width,height] of [[1200,700],[400,900],[1900,350]]) {
  const frustum=new PerspectiveFrustum({fov:Math.PI/3,aspectRatio:width/height,near:1});
  const range=framingRange(bounds.radius,frustum.fovy,frustum.aspectRatio,width,height);
  const angularRadius=Math.asin(bounds.radius/range);
  assert.ok(angularRadius<frustum.fovy/2,'vertical extent fits');
  assert.ok(angularRadius<Math.atan(Math.tan(frustum.fovy/2)*frustum.aspectRatio),'horizontal extent fits');
  assert.equal(framingRange(single.radius,frustum.fovy,frustum.aspectRatio,width,height),1000);
}
console.log("3D geometry, attitude and EGM96 checks passed");

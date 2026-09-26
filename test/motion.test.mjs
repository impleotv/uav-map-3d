import assert from "node:assert/strict";
import test from "node:test";
import {Cartesian3, Cartographic, Quaternion} from "cesium";
import {smoothGroundGeometry, equalGroundGeometry} from "../dist/groundMotion.mjs";
import {smoothPlatformPose} from "../dist/platformMotion.mjs";
import {sensorZoom, sensorLens, smoothSensorCamera} from "../dist/sensorCamera.mjs";
test("sensor camera smooths across heading wrap, settles, and is frame-rate independent",()=>{
  const pose=angle=>({position:new Cartesian3(6378137,0,0),direction:new Cartesian3(Math.cos(angle),Math.sin(angle),0),up:new Cartesian3(0,0,1),...sensorLens({horizontal:60,vertical:40},1)});
  const start=pose(179*Math.PI/180), target={...pose(-179*Math.PI/180),position:new Cartesian3(6378137,100,0),...sensorLens({horizontal:60,vertical:40},2)};
  const halfway=smoothSensorCamera(start,target,0.06);
  assert.ok(halfway.position.y>0&&halfway.position.y<100);
  assert.ok(halfway.direction.x<-0.99,"rotation follows the short arc across 180 degrees");
  assert.ok(Math.abs(Cartesian3.dot(halfway.direction,halfway.up))<1e-12);
  assert.ok(Math.abs(Cartesian3.magnitude(halfway.direction)-1)<1e-12);
  const advance=frames=>{let state=start;for(let i=0;i<frames;i++)state=smoothSensorCamera(state,target,0.5/frames);return state;};
  const reference=advance(15);
  for(const frames of [30,60]) {
    const result=advance(frames);
    assert.ok(Cartesian3.distance(reference.position,result.position)<1e-8,"same position at 30, 60 and 120 FPS");
    assert.ok(Cartesian3.distance(reference.direction,result.direction)<1e-8,"same orientation at 30, 60 and 120 FPS");
    assert.ok(Math.abs(reference.h-result.h)<1e-12&&Math.abs(reference.v-result.v)<1e-12);
  }
  const response=smoothSensorCamera(start,target,0.12);
  assert.ok(response.position.y>17&&response.position.y<19,"camera covers about 18% of the step in 120 ms");
  const lensProgress=(response.h-start.h)/(target.h-start.h);
  assert.ok(lensProgress>0.63&&lensProgress<0.64,"zoom covers about 63% in the same 120 ms");
  const angleProgress=Math.atan2(Cartesian3.cross(start.direction,response.direction,new Cartesian3()).z,Cartesian3.dot(start.direction,response.direction))/(2*Math.PI/180);
  assert.ok(angleProgress>0.17&&angleProgress<0.19,"orientation uses the gentle response too");
  let state=start;
  for(let i=0;i<600;i++) {
    const next=smoothSensorCamera(state,target,1/60);
    assert.ok(next.position.y>=state.position.y&&next.position.y<=target.position.y,"camera approaches without overshooting");
    state=next;
  }
  assert.equal(state,target,"stopped telemetry settles exactly without extrapolation");
  assert.equal(smoothSensorCamera(undefined,target,0),target,"first pose is immediate");
  assert.equal(smoothSensorCamera(start,target,2),target,"resume after suspension snaps to latest pose");
  const teleport={...target,position:new Cartesian3(6378137,20000,0)};
  assert.equal(smoothSensorCamera(start,teleport,0.016),teleport);
});

test("sensor zoom preserves lens proportions and stays within usable bounds",()=>{
  const fov={horizontal:60,vertical:40}, normal=sensorLens(fov,1), zoomed=sensorLens(fov,2);
  assert.equal(zoomed.h,normal.h/2);
  assert.equal(zoomed.v,normal.v/2);
  assert.equal(sensorZoom(16,2),16);
  assert.equal(sensorZoom(0.25,0.5),0.25);
  const wide=sensorLens({horizontal:170,vertical:160},0.25);
  assert.ok(2*Math.atan(wide.h)<Math.PI);
});

test("platform easing handles frame rates, heading wrap, missing attitude, and resets",()=>{
  const start={position:new Cartesian3(6378137,0,0),orientation:Quaternion.fromAxisAngle(Cartesian3.UNIT_Z,179*Math.PI/180)};
  const target={position:new Cartesian3(6378137,100,0),orientation:Quaternion.fromAxisAngle(Cartesian3.UNIT_Z,-179*Math.PI/180)};
  const advance=fps=>{let pose=start;for(let i=0;i<fps;i++)pose=smoothPlatformPose(pose,target,1/fps);return pose;};
  const reference=advance(30);
  for(const fps of [60,120]) {
    const pose=advance(fps);
    assert.ok(Cartesian3.distance(pose.position,reference.position)<1e-8);
    assert.ok(1-Math.abs(Quaternion.dot(pose.orientation,reference.orientation))<1e-12);
  }
  const early=smoothPlatformPose(start,target,0.1);
  assert.ok(Math.abs(early.orientation.z)>0.999,"rotation takes the short arc through 180 degrees");
  let pose=start;
  for(let i=0;i<600;i++)pose=smoothPlatformPose(pose,target,1/60);
  assert.deepEqual(pose,target,"stopped telemetry settles exactly");
  assert.equal(smoothPlatformPose(undefined,target,0),target,"new platform appears immediately");
  assert.equal(smoothPlatformPose(start,target,2),target);
  const far={...target,position:new Cartesian3(6378137,20000,0)};
  assert.equal(smoothPlatformPose(start,far,0.1),far,"large jumps snap");
  const marker={position:target.position,orientation:undefined};
  assert.equal(smoothPlatformPose(start,marker,0.1).orientation,undefined,"missing attitude clears old orientation");
  assert.deepEqual(smoothPlatformPose(marker,target,0.1).orientation,target.orientation,"newly available attitude starts at the latest value");
});

test("ground easing stays on the surface, preserves corner identities, and settles",()=>{
  const point=(lon,lat=32)=>Cartesian3.fromDegrees(lon,lat,0);
  const project=p=>{const c=Cartographic.fromCartesian(p);return Cartesian3.fromRadians(c.longitude,c.latitude,0);};
  const start={center:point(34.8),corners:[point(34.799,31.999),point(34.801,31.999),point(34.801,32.001),point(34.799,32.001)]};
  const target={center:point(34.801),corners:start.corners.map(p=>{const c=Cartographic.fromCartesian(p);return Cartesian3.fromRadians(c.longitude+0.001*Math.PI/180,c.latitude,0);})};
  const advance=fps=>{let state=start;for(let i=0;i<fps;i++)state=smoothGroundGeometry(state,target,1/fps,project);return state;};
  const reference=advance(30);
  for(const fps of [60,120]) {
    const result=advance(fps);
    for(const [i,p] of [result.center,...result.corners].entries()) {
      assert.ok(Cartesian3.distance(p,[reference.center,...reference.corners][i])<0.002,"consistent movement across frame rates");
      assert.ok(Math.abs(Cartographic.fromCartesian(p).height)<1e-6,"interpolation stays on the ground");
    }
  }
  let state=start;
  for(let i=0;i<600;i++)state=smoothGroundGeometry(state,target,1/60,project);
  assert.ok(equalGroundGeometry(state,target),"settles at reported points without extrapolation");
  const partial={center:undefined,corners:[undefined,target.corners[1],undefined,target.corners[3]]};
  const incomplete=smoothGroundGeometry(start,partial,0.1,project);
  assert.equal(incomplete.center,undefined);
  assert.equal(incomplete.corners[0],undefined,"missing corner disappears immediately");
  assert.equal(incomplete.corners[2],undefined);
  const resumed=smoothGroundGeometry(incomplete,target,0,project);
  assert.equal(resumed.corners[0],target.corners[0],"new corner snaps without borrowing another corner's history");
  assert.equal(resumed.corners[1],incomplete.corners[1],"existing corner retains its own history");
  assert.equal(smoothGroundGeometry(undefined,target,0,project),target);
  assert.equal(smoothGroundGeometry(start,target,2,project),target);
  const far={center:point(36),corners:[]};
  assert.equal(smoothGroundGeometry(start,far,0.1,project),far,"large target jumps reset the geometry");
  const terrain=p=>{const c=Cartographic.fromCartesian(p);return Cartesian3.fromRadians(c.longitude,c.latitude,250);};
  const overTerrain=smoothGroundGeometry(start,target,0.1,terrain);
  assert.ok(Math.abs(Cartographic.fromCartesian(overTerrain.center).height-250)<1e-6,"intermediate points use loaded terrain height");
});

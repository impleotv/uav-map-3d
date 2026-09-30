import assert from "node:assert/strict";
import test from "node:test";
import {presentationDefaults,resolvePresentation,presentationError} from "../dist/models.mjs";
import {defaultTargetStyle,normalizeTargetStyle} from "../dist/targetStyle.mjs";
test("presentation inheritance preserves explicit values and supports reset",()=>{
  const global={preset:"helicopter",scale:2}, source={preset:"quadcopter",scale:3};
  const track={preset:"camera",scale:1,visible:false,fixedPosition:null};
  assert.equal(resolvePresentation().preset,"uav");
  assert.equal(resolvePresentation(global,source).preset,"quadcopter");
  assert.equal(resolvePresentation(global,source,track).visible,false);
  assert.equal(resolvePresentation(global,source,track).fixedPosition,null);
  assert.equal(resolvePresentation(global,source,undefined).scale,3);
  assert.equal(resolvePresentation(global,source,track).scale,1);
  assert.deepEqual(source,{preset:"quadcopter",scale:3});
});
test("validate editable numeric values and camera fallbacks",()=>{
  assert.equal(presentationError(presentationDefaults),"");
  for(const patch of [{scale:""},{scale:0},{scale:NaN},{scale:Infinity},{headingOffset:361},{pitchOffset:-361},{preset:"boat"},{fixedPosition:{latitude:NaN,longitude:0,height:0}},{fixedAttitude:{heading:0,pitch:91,roll:0}}]) assert.ok(presentationError(resolvePresentation(patch)),JSON.stringify(patch));
  assert.equal(presentationError(resolvePresentation({scale:.001,headingOffset:-360,fixedPosition:{latitude:0,longitude:0,height:-430}})),"");
});


test("platform appearance inherits nested values without losing false or zero",()=>{
  const legacy={showVmtiTargets:false,frustum:{rays:{width:2,color:"#112233",opacity:.6}}};
  const source={frustum:{groundOutline:{color:"#abcdef"}}};
  const platform={showVmtiTargets:true,frustum:{rays:{opacity:0}}};
  const config=resolvePresentation(legacy,source,platform);
  assert.equal(config.showVmtiTargets,true);
  assert.deepEqual(config.frustum.rays,{width:2,color:"#112233",opacity:0});
  assert.equal(config.frustum.groundOutline.color,"#abcdef");
  assert.equal(resolvePresentation(legacy,source).showVmtiTargets,false);
  config.frustum.rays.width=4;
  assert.equal(legacy.frustum.rays.width,2);
  for(const patch of [{showVmtiTargets:"yes"},{frustum:{rays:{width:""}}},{frustum:{rays:{opacity:2}}},{frustum:{groundOutline:{color:"bad"}}}])assert.ok(presentationError(resolvePresentation(patch)));
  assert.equal(presentationError(resolvePresentation(legacy,source,platform)),"");
});

test("Show Target defaults, partial inheritance, and validation",()=>{
  assert.deepEqual(normalizeTargetStyle(),defaultTargetStyle);
  assert.deepEqual(defaultTargetStyle,{color:"#ff0000",width:2,crosshairSize:24});
  const source={showTarget:false,targetStyle:{color:"#112233",width:4}};
  const track={showTarget:true,targetStyle:{crosshairSize:36}};
  const result=resolvePresentation(source,track);
  assert.equal(resolvePresentation().showTarget,true);
  assert.equal(resolvePresentation(source).showTarget,false);
  assert.equal(result.showTarget,true);
  assert.deepEqual(result.targetStyle,{color:"#112233",width:4,crosshairSize:36});
  result.targetStyle.width=6;
  assert.equal(source.targetStyle.width,4);
  for(const patch of [{showTarget:"yes"},{targetStyle:{color:"red"}},{targetStyle:{width:""}},{targetStyle:{width:0}},{targetStyle:{width:11}},{targetStyle:{crosshairSize:7}},{targetStyle:{crosshairSize:129}}])
    assert.ok(presentationError(resolvePresentation(patch)),JSON.stringify(patch));
  assert.equal(presentationError(resolvePresentation({showTarget:false,targetStyle:{width:0.5,crosshairSize:128}})),"");
});

import assert from "node:assert/strict";
import test from "node:test";
import {presentationDefaults,resolvePresentation,presentationError} from "../dist/models.mjs";
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

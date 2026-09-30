import "@impleotv-pm/uav-map-3d/styles.css";
import { Scene } from "@impleotv-pm/uav-map-3d";
import {BoundingSphere,Cartesian3,HeadingPitchRange} from "cesium";
import type { Platform, ModelConfig, Target } from "@impleotv-pm/uav-map-3d";

const status = document.querySelector<HTMLElement>("#status")!;
const select = document.querySelector<HTMLSelectElement>("#platform")!;
const scene = new Scene(document.querySelector<HTMLElement>("#scene")!, {
  assetBaseUrl: new URL("scene/",document.baseURI).href,
  cesiumBaseUrl: new URL("cesium/",document.baseURI).href,
  onError: message=>{document.querySelector<HTMLElement>("#errors")!.textContent=message;},
});
for(let i=0;i<10;i++)select.add(new Option(`Platform ${i+1}`,`demo-${i}`));
select.onchange=()=>scene.select(select.value);
document.querySelector<HTMLButtonElement>("#fit")!.onclick=()=>scene.fitAll();
for(const mode of ["follow","sensor","orbit"] as const) document.querySelector<HTMLButtonElement>(`#${mode}`)!.onclick=()=>scene.setCameraMode(mode);
const targetToggle=document.querySelector<HTMLInputElement>("#targets")!;
targetToggle.onchange=()=>scene.configureTargets({visible:targetToggle.checked});
let latestPlatforms:Platform[]=[];
let secondary: Scene | undefined;
const secondaryButton=document.querySelector<HTMLButtonElement>("#secondary-toggle")!;
secondaryButton.onclick=()=>{
  const primaryHost=document.querySelector<HTMLElement>("#scene")!;
  if(secondary) {
    secondary.destroy(); secondary=undefined;
    document.querySelector("#secondary")!.remove();
    primaryHost.style.width="100%";
    secondaryButton.textContent="Open second view";
  } else {
    const host=document.createElement("div");host.id="secondary";document.body.append(host);
    primaryHost.style.width="50%";
    secondary=new Scene(host,{
      assetBaseUrl:new URL("scene/",document.baseURI).href,
      cesiumBaseUrl:new URL("cesium/",document.baseURI).href,
      onError:message=>{document.querySelector<HTMLElement>("#errors")!.textContent=message;},
    });
    secondary.upsertPlatforms(latestPlatforms);
    secondary.select("demo-9");secondary.setCameraMode("follow");
    secondaryButton.textContent="Close second view";
  }
  scene.viewer.resize();scene.viewer.scene.requestRender();
};
document.querySelector<HTMLButtonElement>("#target-closeup")!.onclick=()=>{
  const platform=latestPlatforms.find(p=>p.id===select.value);
  const corners=platform?.frameCorners?.filter(p=>p!==null).map(p=>Cartesian3.fromDegrees(p.longitude,p.latitude,0));
  if(!corners?.length)return;
  scene.setCameraMode("orbit");
  scene.viewer.camera.flyToBoundingSphere(BoundingSphere.fromPoints(corners),{duration:0.3,offset:new HeadingPitchRange(0,-Math.PI/2,1000)});
};
const samples:number[]=[],frameTimes:number[]=[];let previousFrame=0;
scene.viewer.scene.postRender.addEventListener(()=>{const now=performance.now();if(previousFrame)frameTimes.push(now-previousFrame);previousFrame=now;if(frameTimes.length>600)frameTimes.shift();});
const percentile=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length*0.95)]??0;
let ticks=0, frames=0; const start=performance.now(); let sampleStart=start, sampleFrames=0;
scene.viewer.scene.postRender.addEventListener(()=>{frames++;});
const update=()=>{
  const updateStart=performance.now();
  const targetStart=scene.targetStats?.projectionMs??0;
  const surfaceStart=scene.targetStats?.surfaceMs??0,positionStart=scene.targetStats?.positionMs??0;
  const t=(performance.now()-start)/1000;
  const platforms:Platform[]=Array.from({length:10},(_,i)=>({
    id:`demo-${i}`,sourceId:`source-${i}`,name:`Platform ${i+1}`,timestamp:String(Math.round(t*1e9)),
    position:{latitude:32+i*0.012+Math.sin(t/40)*0.004,longitude:34.8+Math.cos(t/40)*0.004,height:900+i*80,reference:"ellipsoid"},
    attitude:{heading:(90+t/40*180/Math.PI)%360,pitch:0,roll:10},sensor:{heading:0,pitch:-65,roll:0},
    fov:{horizontal:35,vertical:25},range:null,frameCenter:null,
  }));
  for(const [i,platform] of platforms.entries()) {
    const lat=platform.position!.latitude,lon=platform.position!.longitude;
    const corner=(x:number,y:number)=>({latitude:lat+y*0.001,longitude:lon+x*0.001});
    if(i===0)platform.targetLocation={...corner(0.5,0.5),height:0,reference:"ellipsoid"};
    platform.frameCorners=[corner(-2,2),corner(2,2),corner(1,-2),corner(-1,-2)];
    const targets:Target[]=Array.from({length:50},(_,j)=>{
      const left=0.05+(j%10)*0.09,top=0.05+Math.floor(j/10)*0.18;
      const target:Target={id:`${Math.floor(ticks/100)}-${j}`,box:{left,top,right:left+0.04,bottom:top+0.06}};
      if(j===0)target.center=corner(-1,1);
      if(j===1){target.box=null;target.center=corner(0,0);}
      if(j===2){target.boundary=[corner(0.4,0.4),corner(0.7,0.4),corner(0.7,0.1),corner(0.4,0.1)];target.boundaryKind="Reported geographic contour";}
      return target;
    });
    platform.generation="1";
    platform.targetFrame={key:`${i}:${ticks}`,geometry:{...platform},targets};
  }
  latestPlatforms=platforms;
  scene.upsertPlatforms(platforms);secondary?.upsertPlatforms(platforms);ticks++;
  samples.push(performance.now()-updateStart);if(samples.length>600)samples.shift();
  if(ticks%10===0){
    const now=performance.now(), fps=(frames-sampleFrames)*1000/(now-sampleStart);
    const heap=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize;
    status.textContent=`${ticks} update batches · ${(ticks/Math.max(t,0.1)).toFixed(1)} Hz · ${fps.toFixed(1)} rendered FPS · ${scene.targetStats?.active} targets / ${scene.targetStats?.allocated} slots · update p95 ${percentile(samples).toFixed(1)} ms (last ${samples.at(-1)?.toFixed(1)}; target ${( (scene.targetStats?.projectionMs??0)-targetStart).toFixed(1)}) · frame p95 ${percentile(frameTimes).toFixed(1)} ms · heap ${heap?Math.round(heap/1048576)+" MiB":"unavailable"}`;
    sampleFrames=frames;sampleStart=now;
    status.textContent+=` · surface ${((scene.targetStats?.surfaceMs??0)-surfaceStart).toFixed(1)} / positions ${((scene.targetStats?.positionMs??0)-positionStart).toFixed(1)} ms`;
  }
};
update();
for(let i=0;i<10;i++)scene.configureModel(`demo-${i}`,{preset:["uav","helicopter","quadcopter","camera"][i%4] as ModelConfig["preset"],scale:1,headingOffset:0,pitchOffset:0,rollOffset:0});
scene.select("demo-0");scene.fitAll();
const pause=document.querySelector<HTMLInputElement>("#pause")!;
const timer=setInterval(()=>{if(!pause.checked)update();},100);
window.addEventListener("pagehide",()=>{clearInterval(timer);secondary?.destroy();scene.destroy();},{once:true});

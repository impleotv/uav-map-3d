import {Color, Material, PolylineCollection, PointPrimitiveCollection, Cartesian2} from "cesium";
import {footprintProjection,placeTarget,targetSurfacePoints} from "./targetGeometry.mjs";
import {smoothGroundGeometry,equalGroundGeometry} from "./groundMotion.mjs";

const green=Color.fromCssColorString("#52e08a"),amber=Color.fromCssColorString("#ffc04d");
export class TargetLayer {
  constructor(viewer) {
    this.viewer=viewer;this.visible=true;this.frames=new Map();this.items=new Map();this.free=[];
    this.lines=viewer.scene.primitives.add(new PolylineCollection());
    this.points=viewer.scene.primitives.add(new PointPrimitiveCollection());
    this.surfaceRevision=0;
    this.metrics={updates:0,projectionMs:0,surfaceMs:0,positionMs:0};
    if(typeof document!=="undefined") {
      this.tooltip=document.createElement("div");
      this.tooltip.className="scene-target-tooltip";this.tooltip.hidden=true;
      Object.assign(this.tooltip.style,{position:"fixed",pointerEvents:"none",zIndex:"1000",background:"#14202fee",color:"white",padding:"6px 9px",borderRadius:"4px",font:"12px system-ui",maxWidth:"340px"});
      viewer.container.appendChild(this.tooltip);
      this.move=event=>{
        this.pointer={x:event.clientX,y:event.clientY};
        if(this.hoverFrame)return;
        this.hoverFrame=requestAnimationFrame(()=>{this.hoverFrame=0;this.hover();});
      };
      this.leave=()=>{this.pointer=null;this.hoverKey=null;this.tooltip.hidden=true;};
      viewer.canvas.addEventListener("pointermove",this.move);
      viewer.canvas.addEventListener("pointerleave",this.leave);
    }
  }
  hover() {
    if(!this.pointer||!this.tooltip)return;
    const rect=this.viewer.canvas.getBoundingClientRect();
    const picked=this.visible?this.viewer.scene.pick(new Cartesian2(this.pointer.x-rect.left,this.pointer.y-rect.top)):null;
    const detail=picked?.id;
    this.hoverKey=detail?.key??null;
    this.tooltip.hidden=!detail?.vmti;
    if(detail?.vmti) {
      this.tooltip.textContent=`Target ${detail.targetId} · ${detail.source} · ${detail.description}`;
      this.tooltip.style.left=`${Math.max(0,Math.min(this.pointer.x+12,window.innerWidth-360))}px`;
      this.tooltip.style.top=`${Math.min(this.pointer.y+12,window.innerHeight-70)}px`;
    }
  }
  configure({visible=true}={}) {
    if(typeof visible!=="boolean")throw new Error("Target visibility must be a boolean");
    if(this.visible===visible)return;
    this.visible=visible;this.lines.show=visible;this.points.show=visible;
    if(this.tooltip)this.tooltip.hidden=true;
    if(visible)for(const [id,state] of this.frames)this.draw(id,state);
    this.viewer.scene.requestRender();
  }
  invalidateSurface(){this.surfaceRevision++;}
  upsert(id,source,generation,frame,corners,project,shared=false) {
    if(!frame?.targets.length){this.remove(id);return;}
    let state=this.frames.get(id);
    const next={corners:corners||[]};
    if(state?.generation!==generation){this.remove(id);state=null;}
    const changed=!state||state.frame!==frame||!equalGroundGeometry(state.targetGround,next)||state.revision!==this.surfaceRevision||state.source!==source;
    if(!state)state={generation,ground:undefined};
    Object.assign(state,{frame,source,project,shared,targetGround:next,revision:this.surfaceRevision});
    state.ground=smoothGroundGeometry(state.ground,next,0,project);
    this.frames.set(id,state);
    if(changed&&this.visible)this.draw(id,state);
  }
  tick(elapsed,sharedCorners) {
    if(!this.visible)return;
    for(const [id,state] of this.frames) {
      const shared=state.shared?sharedCorners(id):null;
      const ground=shared?{corners:shared}:smoothGroundGeometry(state.ground,state.targetGround,elapsed,state.project);
      if(!equalGroundGeometry(ground,state.ground)) {
        state.ground=ground;this.draw(id,state);
        this.viewer.scene.requestRender();
      }
    }
  }
  draw(id,state) {
    const start=performance.now(),mapping=footprintProjection(state.ground?.corners);
    const wanted=new Set();
    // Retire first so new IDs in a replacement frame can reuse existing slots.
    const nextKeys=new Set(state.frame.targets.map(t=>JSON.stringify([id,state.generation,t.id])));
    for(const [key,item] of this.items)if(item.owner===id&&!nextKeys.has(key))this.release(key,item);
    for(const target of state.frame.targets) {
      const placement=placeTarget(target,mapping);
      if(!placement)continue;
      const key=JSON.stringify([id,state.generation,target.id]);wanted.add(key);
      let item=this.items.get(key);
      if(!item) {
        item=this.free.pop()||{line:this.lines.add({show:false,width:2}),point:this.points.add({show:false,pixelSize:7,outlineColor:Color.BLACK,outlineWidth:1})};
        item.owner=id;this.items.set(key,item);
      }
      const surfaceStart=performance.now();
      const positions=targetSurfacePoints(placement,state.project);
      this.metrics.surfaceMs+=performance.now()-surfaceStart;
      const detail={vmti:true,key,targetId:target.id,source:state.source,description:placement.description};
      item.line.id=detail;item.point.id=detail;
      if(item.estimated!==placement.estimated) {
        item.line.material=Material.fromType(placement.estimated?"PolylineDash":"Color",{color:placement.estimated?amber:green});
        item.point.color=placement.estimated?amber:green;item.estimated=placement.estimated;
      }
      item.line.show=placement.closed;item.point.show=!placement.closed;
      const positionStart=performance.now();
      if(placement.closed)item.line.positions=positions;else item.point.position=positions[0];
      this.metrics.positionMs+=performance.now()-positionStart;
    }
    for(const [key,item] of this.items)if(item.owner===id&&!wanted.has(key))this.release(key,item);
    this.metrics.updates++;this.metrics.projectionMs+=performance.now()-start;
    if(this.tooltip&&this.hoverKey) {
      const hovered=this.items.get(this.hoverKey)?.line.id;
      this.tooltip.hidden=!hovered;
      if(hovered)this.tooltip.textContent=`Target ${hovered.targetId} · ${hovered.source} · ${hovered.description}`;
    }
  }
  release(key,item){item.line.show=false;item.point.show=false;item.line.id=undefined;item.point.id=undefined;this.items.delete(key);this.free.push(item);}
  remove(id) {
    this.frames.delete(id);
    for(const [key,item] of this.items)if(item.owner===id)this.release(key,item);
    if(this.tooltip)this.tooltip.hidden=true;
    if(!this.frames.size){this.lines.removeAll();this.points.removeAll();this.free=[];}
  }
  get stats(){return {...this.metrics,active:this.visible?this.items.size:0,allocated:this.items.size+this.free.length};}
  framingPoints() {
    if(!this.visible)return [];
    return Array.from(this.items.values()).flatMap(item=>item.line.show?item.line.positions:[item.point.position]);
  }
  destroy() {
    if(this.move){this.viewer.canvas.removeEventListener("pointermove",this.move);this.viewer.canvas.removeEventListener("pointerleave",this.leave);}
    if(this.hoverFrame)cancelAnimationFrame(this.hoverFrame);
    this.tooltip?.remove();this.frames.clear();this.items.clear();this.free=[];
    this.viewer.scene.primitives.remove(this.lines);this.viewer.scene.primitives.remove(this.points);
  }
}

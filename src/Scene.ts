import {
  Viewer, Cartesian3, Cartographic, Matrix4, Transforms, Quaternion,
  Cartesian2, Color, ColorMaterialProperty, ArcType, ConstantPositionProperty, ConstantProperty, CallbackProperty, Entity, PolygonHierarchy,
  UrlTemplateImageryProvider, CesiumTerrainProvider, EllipsoidTerrainProvider,
  Ellipsoid, Ray, IntersectionTests, PerspectiveFrustum,
  HeadingPitchRange, Math as CesiumMath, buildModuleUrl,
  GeographicTilingScheme, WebMercatorTilingScheme, Model,
} from "cesium";
import { sensorGroundGeometry, groundOutlineSegments } from "./ground.mjs";
import { sceneAxes } from "./math.mjs";
import { modelUrl, presentationDefaults, presentationName } from "./models.mjs";
import { modelOrientation } from "./orientation.mjs";
import { normalizeFrustumStyle } from "./frustumStyle.mjs";
import { sceneBounds, framingRange } from "./framing.mjs";
import { sensorViewPosition, groundReferenceFromRange } from "./sensorView.mjs";
import { sensorZoom, sensorLens, smoothSensorCamera } from "./sensorCamera.mjs";
import { smoothPlatformPose } from "./platformMotion.mjs";
import { smoothGroundGeometry, equalGroundGeometry } from "./groundMotion.mjs";
import { readGeoidGrid } from "./geoid.mjs";
import { TargetLayer } from "./TargetLayer.mjs";
import type { Platform, ModelConfig, SceneOptions, MapConfig, CameraMode, Position, GroundPosition, FrustumStyle, LineStyle } from "./types.js";

type PlatformPose = {position: Cartesian3; orientation?: Quaternion};
type GroundGeometry = {center?: Cartesian3; corners: (Cartesian3 | undefined)[]};
type Entry = { data: Platform; config: ModelConfig; model: Entity; graphics: Entity[]; lines: Cartesian3[][]; rays?: Cartesian3[][]; pose?: PlatformPose; targetOrientation?: Quaternion; ground?: GroundGeometry; targetGround?: GroundGeometry; projectGround?: (point: Cartesian3) => Cartesian3; footprint?: Cartesian3[]; sensor?: { direction: Cartesian3; up: Cartesian3; right: Cartesian3 }; position?: Cartesian3; sensorPosition?: Cartesian3 };
const defaults: ModelConfig = presentationDefaults as ModelConfig;
const radians = CesiumMath.toRadians;

export class Scene {
  readonly viewer: Viewer;
  private platforms = new Map<string, Entry>();
  private selected: string | null = null;
  private mode: CameraMode = "orbit";
  private sensorZoomFactor = 1;
  private sensorCamera?: ReturnType<typeof smoothSensorCamera>;
  private sensorCameraId: string | null = null;
  private sensorCameraTime = 0;
  private platformUpdateTime = 0;
  private sensorWheel = (event: WheelEvent) => {
    if (this.mode !== "sensor") return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewer.canvas.clientHeight : 1);
    this.zoomSensor(Math.exp(-Math.max(-300, Math.min(300, pixels)) * 0.002));
  };
  private destroyed = false;
  private mapGeneration = 0;
  private initialFramed = false;
  private geoid: ((lat: number, lon: number) => number) | null = null;
  private removeCameraListener: () => void;
  private removeSelectionListener: () => void;
  private removeTerrainListener: () => void;
  private removePrimitiveListener: () => void;
  private modelChecks = new Map<string, "loading" | "valid" | "failed">();
  private options: SceneOptions;
  private frustumStyle: FrustumStyle = normalizeFrustumStyle();
  private targets?: TargetLayer;

  constructor(container: HTMLElement, options: SceneOptions) {
    this.options = options;
    (buildModuleUrl as typeof buildModuleUrl & {setBaseUrl(url: string): void}).setBaseUrl(options.cesiumBaseUrl);
    this.viewer = new Viewer(container, {
      baseLayer: false, baseLayerPicker: false, geocoder: false, animation: false,
      timeline: false, homeButton: false, navigationHelpButton: false,
      sceneModePicker: false, fullscreenButton: false, selectionIndicator: true,
      infoBox: false, requestRenderMode: true, maximumRenderTimeChange: Infinity,
      terrainProvider: new EllipsoidTerrainProvider(), shouldAnimate: false,
    });
    this.viewer.scene.globe.depthTestAgainstTerrain = true;
    this.targets = new TargetLayer(this.viewer);
    this.viewer.canvas.addEventListener("wheel", this.sensorWheel, {passive:false});
    this.viewer.scene.globe.baseColor = Color.fromCssColorString("#273f4b");
    this.removeCameraListener = this.viewer.scene.preUpdate.addEventListener(() => {
      this.updatePlatforms();
      this.updateCamera();
    });
    this.removePrimitiveListener = this.viewer.scene.primitives.primitiveAdded.addEventListener(primitive => {
      if (primitive instanceof Model) primitive.errorEvent.addEventListener(error => {
        this.error(`Model resource could not load: ${error.message}`);
      });
    });
    this.removeTerrainListener = this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(count => {
      if (count === 0) {
        this.targets?.invalidateSurface();
        for (const entry of this.platforms.values()) this.render(entry);
        this.viewer.scene.requestRender();
      }
    });
    this.removeSelectionListener = this.viewer.selectedEntityChanged.addEventListener(entity => {
      const id = entity?.id?.replace(/:graphic:.*$/, "") ?? null;
      if (!id || this.platforms.has(id)) {
        const previous = this.selected ? this.platforms.get(this.selected) : undefined;
        if (previous) previous.model.show = previous.config.visible !== false && !!previous.position;
        this.selected = id;
        if (this.mode === "follow") this.setCameraMode("follow");
        options.onSelect?.(id);
      }
    });
    this.viewer.scene.renderError.addEventListener((_scene, error) => this.error(`3D rendering failed: ${error.message}`));
    void fetch(new URL("geoid/egm96_15.gtx", options.assetBaseUrl)).then(r => {
      if (!r.ok) throw new Error("Geoid grid unavailable");
      return r.arrayBuffer();
    }).then(buffer => {
      if (this.destroyed) return;
      this.geoid = readGeoidGrid(buffer);
      this.targets?.invalidateSurface();
      for (const entry of this.platforms.values()) this.render(entry);
      if (!this.initialFramed && [...this.platforms.values()].some(entry=>entry.position)) {
        this.initialFramed = true;
        this.select(this.platforms.keys().next().value ?? null);
        this.fitAll();
      }
    }).catch(error => this.error(`${error.message}; MSL positions cannot be displayed accurately.`));
  }

  private error(message: string) { if (!this.destroyed) this.options.onError?.(message); }
  configureTargets(options: {visible?:boolean} = {}) {
    this.targets?.configure(options);
    if(this.targets?.visible)for(const entry of this.platforms.values())this.renderTargets(entry);
  }
  get targetStats() { return this.targets?.stats; }
  configureFrustum(style: {rays?:Partial<LineStyle>;groundOutline?:Partial<LineStyle>}) {
    this.frustumStyle=normalizeFrustumStyle(style);
    if(this.destroyed)return;
    for(const entry of this.platforms.values())this.render(entry);
    this.viewer.scene.requestRender();
  }
  private worldPosition(p: Position | GroundPosition | null): Cartesian3 | undefined {
    if (!p || typeof p.height!=="number" || ![p.latitude,p.longitude,p.height].every(Number.isFinite) || Math.abs(p.latitude)>90 || Math.abs(p.longitude)>180) return;
    if (p.reference === "msl" && !this.geoid) return;
    const height = p.height + (p.reference === "msl" ? this.geoid!(p.latitude,p.longitude) : 0);
    return Cartesian3.fromDegrees(p.longitude,p.latitude,height);
  }

  upsertPlatforms(platforms: Platform[]) {
    for (const data of platforms) {
      if (!data.id || !data.sourceId) continue;
      let entry = this.platforms.get(data.id);
      if(entry&&entry.data.generation!==data.generation) {
        entry.pose=undefined;entry.ground=undefined;entry.targetGround=undefined;
        this.targets?.remove(data.id);
      }
      if (!entry) {
        entry = { data, config: {...defaults}, model: this.viewer.entities.add({id:data.id}), graphics:[], lines:[] };
        this.platforms.set(data.id,entry);
      }
      entry.data = data;
      this.render(entry);
    }
    this.viewer.scene.requestRender();
    if (!this.initialFramed && ([...this.platforms.values()].some(entry=>entry.position)||(this.targets?.stats.active??0)>0)) {
      this.initialFramed = true;
      this.select(platforms[0]?.id ?? null);
      this.fitAll();
    }
  }

  configureModel(id: string, config: ModelConfig) {
    const entry = this.platforms.get(id); if (!entry) return;
    entry.config = {...defaults,...config}; this.render(entry);
    // A configured stationary position may be the first usable position,
    // including when reopening after the geoid grid has already loaded.
    if (!this.initialFramed && entry.position) {
      this.initialFramed = true;
      this.select(id);
      this.fitAll();
    }
  }

  private checkModel(url: string) {
    if (this.modelChecks.has(url)) return;
    this.modelChecks.set(url,"loading");
    void Model.fromGltfAsync({url,incrementallyLoadTextures:false}).then(model=>{
      model.destroy();
      if (!this.destroyed) this.modelChecks.set(url,"valid");
    }).catch(error=>{
      if (this.destroyed) return;
      this.modelChecks.set(url,"failed");
      this.error(`Model could not load: ${String(error)}. Showing a position marker.`);
    }).finally(()=>{
      if (!this.destroyed) for (const entry of this.platforms.values()) if (entry.config.url===url) this.render(entry);
    });
  }

  private render(entry: Entry) {
    if (this.destroyed) return;
    try {
    for (const graphic of entry.graphics) graphic.show = false;
    entry.lines = []; entry.rays = []; entry.footprint = undefined; entry.sensor = undefined; entry.sensorPosition = undefined;
    entry.targetGround = undefined;
    const {data,config,model} = entry;
    const position = this.worldPosition(data.position ?? (config.preset === "camera" && data.validity?.position!=="invalid" ? config.fixedPosition ?? null : null));
    entry.position = position;
    model.show = config.visible !== false && !!position;
    if (!position) { entry.pose = undefined; entry.ground = undefined; entry.targetOrientation = undefined; this.options.onStatus?.(data.id,"Position or altitude unavailable"); return; }
    const project=(point:Cartesian3)=>{
      const cartographic=Cartographic.fromCartesian(point);
      const height=this.viewer.scene.globe.getHeight(cartographic) ?? 0;
      return Cartesian3.fromRadians(cartographic.longitude,cartographic.latitude,height);
    };
    const surfacePosition=(p:GroundPosition)=>project(Cartesian3.fromDegrees(p.longitude,p.latitude,0));
    const frameCenterSurface=data.frameCenter?surfacePosition(data.frameCenter):undefined;
    const frameCornerSurfaces=data.frameCorners?.map(corner=>corner?surfacePosition(corner):undefined);
    const ellipsoidGround=this.viewer.terrainProvider instanceof EllipsoidTerrainProvider;
    const frameCenter=this.worldPosition(data.frameCenter) ?? (ellipsoidGround?groundReferenceFromRange(position,frameCenterSurface,data.range):undefined);
    const frameCorners=data.frameCorners?.map(corner=>this.worldPosition(corner));
    // Negative geodetic heights are valid. An ellipsoid-only globe otherwise
    // buries these platforms; display their estimated height above the local
    // target surface while retaining the original signed telemetry coordinates.
    const belowSurface=ellipsoidGround&&Cartographic.fromCartesian(position).height<0;
    const placement=belowSurface&&frameCenter?sensorViewPosition({origin:position,direction:undefined,range:data.range,frameCenter,ellipsoidGround,project}):undefined;
    const displayPosition=placement?.position ?? position;
    if (!entry.pose || Cartesian3.distance(entry.pose.position,displayPosition)>10000) entry.ground=undefined;
    entry.position=displayPosition;
    model.name = presentationName(config, data.name);
    const color = data.stale ? Color.GRAY : Color.fromCssColorString("#65c9ff");
    model.label = {text: presentationName(config, data.name), font:"13px sans-serif", fillColor:Color.WHITE,
      showBackground:true, backgroundColor:Color.BLACK.withAlpha(0.65), pixelOffset: new Cartesian2(0,-64),
      disableDepthTestDistance: 0} as any;
    const attitude = data.attitude ?? (config.preset === "camera" && data.validity?.attitude!=="invalid" ? config.fixedAttitude : null);
    if (config.url) this.checkModel(config.url);
    if (attitude && (!config.url || this.modelChecks.get(config.url)==="valid")) {
      entry.targetOrientation = modelOrientation(position,attitude,
        {heading:config.headingOffset,pitch:config.pitchOffset,roll:config.rollOffset});
      const uri = modelUrl(config,this.options.assetBaseUrl);
      model.model = {uri,scale:config.scale,minimumPixelSize:96,maximumScale:Math.max(1,config.scale)*600,
        color:Color.WHITE, silhouetteColor:color,silhouetteSize:1} as any;
      model.point = undefined;
    } else {
      model.model = undefined; entry.targetOrientation = undefined;
      model.point = {pixelSize:10,color,outlineColor:Color.WHITE,outlineWidth:1} as any;
    }
    this.applyPlatformPose(entry, smoothPlatformPose(entry.pose,{position:displayPosition,orientation:entry.targetOrientation},0));
    if (config.visible === false) { entry.ground=undefined; this.viewer.scene.requestRender(); return; }
    const addLine = (points: Cartesian3[], groundOutline = false) => {
      const index = entry.lines.length;
      if (!groundOutline) {
        points[0] = entry.pose!.position;
        entry.rays!.push(points);
      }
      entry.lines.push(points);
      let entity = this.viewer.entities.getById(`${data.id}:graphic:line-${index}`);
      if (!entity) {
        entity = this.viewer.entities.add({id:`${data.id}:graphic:line-${index}`,
          polyline:{positions:new CallbackProperty(()=>entry.lines[index]??[],false)}});
        entry.graphics.push(entity);
      }
      // Line indices can be reused as partial telemetry arrives; refresh the
      // style so a ground edge never inherits a faint sensor-ray appearance.
      const line=entity.polyline!;
      const style=groundOutline?this.frustumStyle.groundOutline:this.frustumStyle.rays;
      line.width=new ConstantProperty(style.width);
      line.material=new ColorMaterialProperty((data.stale?Color.GRAY:Color.fromCssColorString(style.color)).withAlpha(style.opacity));
      line.clampToGround=new ConstantProperty(groundOutline);
      line.arcType=new ConstantProperty(groundOutline?ArcType.GEODESIC:ArcType.NONE);
      entity.show = true;
    };
    const sensor = data.sensor ?? (config.preset === "camera" && config.fixedAttitude && data.validity?.sensor!=="invalid" ? {heading:0,pitch:0,roll:0} : null);
    if (attitude && sensor) {
      const local = sceneAxes(attitude,sensor);
      const transform = Transforms.eastNorthUpToFixedFrame(position);
      const world = (v: number[]) => Cartesian3.normalize(Matrix4.multiplyByPointAsVector(transform,new Cartesian3(...v),new Cartesian3()),new Cartesian3());
      entry.sensor = {direction:world(local.forward),up:world(local.up),right:world(local.right)};
    }
    const viewpoint=entry.sensor?sensorViewPosition({origin:position,direction:entry.sensor.direction,
      frameCenter,range:data.range,ellipsoidGround,project}):undefined;
    entry.sensorPosition=viewpoint?.position;
    const ground=sensorGroundGeometry({origin:position,
      axes:entry.sensor?{forward:entry.sensor.direction,right:entry.sensor.right,up:entry.sensor.up}:undefined,
      fov:data.fov,frameCenter,frameCorners,
      frameCenterSurface,frameCornerSurfaces,frameCenterOffEarth:data.frameCenterOffEarth,frameCornersOffEarth:data.frameCornersOffEarth,
      range:data.range,ellipsoidGround,
      intersect:(direction:Cartesian3)=>this.intersect(position,direction),
      project});
    entry.targetGround = {center:ground.center,corners:ground.corners};
    entry.projectGround = project;
    entry.ground = smoothGroundGeometry(entry.ground,entry.targetGround,0,project);
    const displayedGround=entry.ground!;
    if(displayedGround.center)addLine([displayPosition,displayedGround.center]);
    for(const corner of displayedGround.corners)if(corner)addLine([displayPosition,corner]);
    for(const segment of groundOutlineSegments(displayedGround.corners))addLine(segment,true);
    if(displayedGround.corners.length===4&&displayedGround.corners.every(Boolean)) {
      const points=displayedGround.corners as Cartesian3[];
      entry.footprint=points;
      let footprint=this.viewer.entities.getById(`${data.id}:graphic:footprint`);
      if(!footprint) {
        footprint=this.viewer.entities.add({id:`${data.id}:graphic:footprint`,polygon:{hierarchy:new CallbackProperty(()=>new PolygonHierarchy(entry.footprint??[]),false),material:color.withAlpha(0.04),perPositionHeight:true}});
        entry.graphics.push(footprint);
      }
      footprint.polygon!.material=new ColorMaterialProperty((data.stale?Color.GRAY:Color.fromCssColorString(this.frustumStyle.groundOutline.color)).withAlpha(0.04));
      footprint.show=true;
    }
    const status=ground.center||ground.corners.some(Boolean)||data.frameCenterOffEarth||data.frameCornersOffEarth?.some(Boolean)?ground.status:attitude?"Sensor orientation incomplete":"Platform attitude unavailable";
    this.options.onStatus?.(data.id,status+(placement?.approximate?" · Platform height above map estimated from target/range (approximate)":"")+(viewpoint?.approximate?" · Sensor viewpoint corrected for flat map (approximate)":""));
    if(this.mode==="sensor"&&this.selected===data.id)model.show=false;
    this.viewer.scene.requestRender();
    } finally {
      this.renderTargets(entry);
    }
  }

  private renderTargets(entry: Entry) {
    if(!this.targets)return;
    const frame=entry.data.targetFrame;
    if(!frame||entry.data.stale||entry.config.visible===false){this.targets.remove(entry.data.id);return;}
    if(!this.targets.visible)return;
    // The detection packet supplies geometry, never independently merged fields.
    const data=frame.geometry;
    const ellipsoidGround=this.viewer.terrainProvider instanceof EllipsoidTerrainProvider;
    const project=(point:Cartesian3)=>{
      const p=Cartographic.fromCartesian(point);
      return Cartesian3.fromRadians(p.longitude,p.latitude,ellipsoidGround?0:this.viewer.scene.globe.getHeight(p)??0);
    };
    const surface=(p:GroundPosition)=>project(Cartesian3.fromDegrees(p.longitude,p.latitude,0));
    const position=this.worldPosition(data.position);
    let axes;
    if(position&&data.attitude&&data.sensor) {
      const local=sceneAxes(data.attitude,data.sensor),transform=Transforms.eastNorthUpToFixedFrame(position);
      const world=(v:number[])=>Cartesian3.normalize(Matrix4.multiplyByPointAsVector(transform,new Cartesian3(...v),new Cartesian3()),new Cartesian3());
      axes={forward:world(local.forward),right:world(local.right),up:world(local.up)};
    }
    const frameCenterSurface=data.frameCenter?surface(data.frameCenter):undefined;
    const frameCenter=this.worldPosition(data.frameCenter)??(position&&ellipsoidGround?groundReferenceFromRange(position,frameCenterSurface,data.range):undefined);
    const ground=sensorGroundGeometry({origin:position??new Cartesian3(),axes,fov:data.fov,
      frameCenter,frameCenterSurface,frameCorners:data.frameCorners?.map(p=>this.worldPosition(p)),
      frameCornerSurfaces:data.frameCorners?.map(p=>p?surface(p):undefined),
      frameCenterOffEarth:data.frameCenterOffEarth,frameCornersOffEarth:data.frameCornersOffEarth,
      range:data.range,ellipsoidGround,intersect:(direction:Cartesian3)=>position?this.intersect(position,direction):undefined,project});
    const corners=ground.corners.length===4&&ground.corners.every(Boolean)&&!data.frameCornersOffEarth?.some(Boolean)?ground.corners:[];
    const shared=!!entry.targetGround&&equalGroundGeometry({corners},{corners:entry.targetGround.corners});
    this.targets.upsert(entry.data.id,presentationName(entry.config,entry.data.name),entry.data.generation??"",frame,corners,project,shared);
  }

  private applyPlatformPose(entry: Entry, pose: PlatformPose) {
    entry.pose = pose;
    if (entry.model.position instanceof ConstantPositionProperty) entry.model.position.setValue(pose.position);
    else entry.model.position = new ConstantPositionProperty(pose.position);
    if (pose.orientation) {
      if (entry.model.orientation instanceof ConstantProperty) entry.model.orientation.setValue(pose.orientation);
      else entry.model.orientation = new ConstantProperty(pose.orientation);
    } else entry.model.orientation = undefined;
    for (const ray of entry.rays ?? []) ray[0] = pose.position;
  }

  private updatePlatforms(now = performance.now()) {
    const elapsed = (now - (this.platformUpdateTime || now)) / 1000;
    this.platformUpdateTime = now;
    for (const entry of this.platforms.values()) {
      if (!entry.position) continue;
      const previous = entry.pose;
      const pose = smoothPlatformPose(previous,{position:entry.position,orientation:entry.targetOrientation},elapsed);
      const poseChanged = !previous || !Cartesian3.equals(previous.position,pose.position) || !Quaternion.equals(previous.orientation,pose.orientation);
      if (poseChanged) this.applyPlatformPose(entry,pose);
      let groundChanged = false;
      if (entry.targetGround && entry.projectGround) {
        const ground = smoothGroundGeometry(entry.ground,entry.targetGround,elapsed,entry.projectGround);
        groundChanged = !equalGroundGeometry(entry.ground,ground);
        if (groundChanged) {
          entry.ground = ground;
          // Same ordering as render(), with shared corner objects for the fill,
          // closed outline and sensor rays. No entity recreation per frame.
          entry.lines = []; entry.rays = []; entry.footprint = undefined;
          for (const point of [ground.center,...ground.corners]) if (point) {
            const ray = [pose.position,point];
            entry.lines.push(ray); entry.rays.push(ray);
          }
          entry.lines.push(...groundOutlineSegments(ground.corners));
          if (ground.corners.length===4 && ground.corners.every(Boolean)) {
            const points=ground.corners as Cartesian3[];
            entry.footprint=points;
          }
        }
      }
      if (poseChanged || groundChanged) this.viewer.scene.requestRender();
    }
    this.targets?.tick(elapsed,(id:string)=>this.platforms.get(id)?.ground?.corners);
  }

  private intersect(origin: Cartesian3, direction: Cartesian3): Cartesian3 | undefined {
    const ray = new Ray(origin,direction);
    const terrain = this.viewer.scene.globe.pick(ray,this.viewer.scene);
    if (terrain) return terrain;
    if (!(this.viewer.terrainProvider instanceof EllipsoidTerrainProvider)) return;
    const interval = IntersectionTests.rayEllipsoid(ray,Ellipsoid.WGS84);
    if (!interval || interval.start < 0) return;
    return Ray.getPoint(ray,interval.start);
  }

  select(id: string | null) {
    if (this.selected) {
      const previous = this.platforms.get(this.selected);
      if (previous) previous.model.show = previous.config.visible !== false && !!previous.position;
    }
    this.selected = id && this.platforms.has(id) ? id : null;
    this.viewer.selectedEntity = this.selected ? this.platforms.get(this.selected)?.model : undefined;
    if (this.mode === "follow") this.setCameraMode("follow");
    this.viewer.scene.requestRender();
  }

  setCameraMode(mode: CameraMode) {
    const entry = this.selected ? this.platforms.get(this.selected) : undefined;
    if (mode === "sensor" && (!entry?.sensor || !entry.data.fov)) { this.error("Select a platform with complete sensor orientation and FOV."); return; }
    this.viewer.camera.cancelFlight();
    this.viewer.trackedEntity = undefined;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.camera.frustum = new PerspectiveFrustum({fov:radians(60),aspectRatio:this.viewer.canvas.clientWidth/Math.max(1,this.viewer.canvas.clientHeight),near:1});
    for (const item of this.platforms.values()) item.model.show = item.config.visible !== false && !!item.position;
    this.mode = mode;
    this.sensorCamera = undefined;
    this.sensorZoomFactor = 1;
    this.options.onCameraMode?.(mode);
    if (mode === "follow" && entry?.position) {
      entry.model.viewFrom = new ConstantProperty(new Cartesian3(-300,-300,200));
      this.viewer.trackedEntity = entry.model;
    }
    this.viewer.scene.screenSpaceCameraController.enableInputs = mode !== "sensor";
    this.updateCamera(); this.viewer.scene.requestRender();
  }

  zoomSensor(factor: number) {
    if (this.mode !== "sensor" || !Number.isFinite(factor) || factor <= 0) return;
    this.sensorZoomFactor = sensorZoom(this.sensorZoomFactor, factor);
    this.viewer.scene.requestRender();
  }

  resetSensorZoom() {
    this.sensorZoomFactor = 1;
    this.viewer.scene.requestRender();
  }

  private updateCamera() {
    if (this.mode !== "sensor") return;
    if (!this.selected) { this.setCameraMode("orbit"); return; }
    const entry = this.platforms.get(this.selected);
    if (!entry?.position || !entry.sensor || !entry.data.fov || entry.config.visible === false) { this.setCameraMode("orbit"); return; }
    if (this.sensorCameraId !== this.selected) {
      this.sensorCamera = undefined;
      this.sensorZoomFactor = 1;
      this.sensorCameraId = this.selected;
    }
    const now = performance.now();
    const target = {position:entry.sensorPosition ?? entry.position, ...entry.sensor, ...sensorLens(entry.data.fov,this.sensorZoomFactor)};
    const previous = this.sensorCamera;
    const pose = smoothSensorCamera(previous,target,(now-this.sensorCameraTime)/1000);
    this.sensorCamera = pose;
    this.sensorCameraTime = now;
    entry.model.show = false;
    if (previous && Cartesian3.equals(previous.position,pose.position) && Cartesian3.equals(previous.direction,pose.direction) &&
      Cartesian3.equals(previous.up,pose.up) && previous.h===pose.h && previous.v===pose.v) return;
    const {direction,up,h,v} = pose;
    this.viewer.camera.setView({destination:pose.position,orientation:{direction,up}});
    // Cesium's 3D camera controller requires PerspectiveFrustum. Its fov is
    // horizontal for landscape frustums and vertical for portrait frustums.
    this.viewer.camera.frustum = new PerspectiveFrustum({fov:2*Math.atan(Math.max(h,v)),aspectRatio:h/v,near:1,far:50000000});
    entry.model.show = false; // Avoid looking through the platform mesh.
    this.viewer.scene.requestRender();
  }

  fitAll() {
    this.viewer.camera.cancelFlight();
    this.viewer.resize();
    this.setCameraMode("orbit");
    for (const entry of this.platforms.values()) entry.model.show = entry.config.visible !== false && !!entry.position;
    const bounds = sceneBounds(this.platforms.values(),this.targets?.framingPoints()??[]);
    if (!bounds) return;
    const frustum = this.viewer.camera.frustum as PerspectiveFrustum;
    const canvas = this.viewer.canvas;
    const range = framingRange(bounds.radius,frustum.fovy,frustum.aspectRatio,canvas.clientWidth,canvas.clientHeight);
    this.viewer.camera.flyToBoundingSphere(bounds,{duration:0.6,offset:new HeadingPitchRange(0,-0.65,range)});
  }

  removePlatform(id: string) {
    const entry = this.platforms.get(id); if (!entry) return;
    if (id === this.selected) { this.setCameraMode("orbit"); this.select(null); }
    this.viewer.entities.remove(entry.model); for (const entity of entry.graphics) this.viewer.entities.remove(entity);
    this.platforms.delete(id);
    this.targets?.remove(id);
    // Stop/end-of-file removes all entities. A subsequent playback session
    // must select and frame its first usable platform again, just like opening
    // the view. Otherwise the previous selection stays null indefinitely.
    if (this.platforms.size === 0) this.initialFramed = false;
    this.viewer.scene.requestRender();
  }
  resetSource(sourceId: string) { for (const [id,entry] of this.platforms) if (entry.data.sourceId === sourceId) this.removePlatform(id); }

  async configureMap(config: MapConfig) {
    const generation = ++this.mapGeneration;
    // Offline callers supply only explicitly configured local asset/server URLs.
    let terrain = new EllipsoidTerrainProvider() as EllipsoidTerrainProvider | CesiumTerrainProvider;
    if (config.terrainUrl) {
      try { terrain = await CesiumTerrainProvider.fromUrl(config.terrainUrl); }
      catch(error) { this.error(`Terrain could not load: ${String(error)}. Using the ellipsoid globe.`); }
    }
    if (this.destroyed || generation !== this.mapGeneration) return;
    this.viewer.terrainProvider = terrain;
    this.targets?.invalidateSurface();
    terrain.errorEvent.addEventListener(error => this.error(`Terrain tile unavailable: ${error.message}`));
    this.viewer.imageryLayers.removeAll();
    if (config.imageryUrl) {
      const provider = new UrlTemplateImageryProvider({url:config.imageryScheme==="tms" ? config.imageryUrl.replaceAll("{y}","{reverseY}") : config.imageryUrl,credit:config.imageryAttribution,maximumLevel:config.imageryMaxLevel??19,
        tilingScheme:config.imageryProjection==="geographic"?new GeographicTilingScheme():new WebMercatorTilingScheme()});
      provider.errorEvent.addEventListener(error => this.error(`Imagery tile unavailable: ${error.message}`));
      this.viewer.imageryLayers.addImageryProvider(provider);
    }
    for (const entry of this.platforms.values()) this.render(entry);
    this.viewer.scene.requestRender();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; ++this.mapGeneration;
    this.viewer.canvas.removeEventListener("wheel", this.sensorWheel);
    this.removeCameraListener(); this.removeSelectionListener(); this.removeTerrainListener(); this.removePrimitiveListener();
    this.modelChecks.clear();
    this.targets?.destroy();
    this.platforms.clear(); this.viewer.destroy();
  }
}

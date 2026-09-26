import assert from "node:assert/strict";
import test from "node:test";
import {uavMap3dAssets} from "../dist/vite.mjs";

test("runtime assets serve under a base path and emit the same self-contained resources",()=>{
  const plugin=uavMap3dAssets({scenePath:"maps/scene",cesiumPath:"maps/cesium"});
  plugin.configResolved({base:"/product/"});
  let middleware;
  plugin.configureServer({middlewares:{use(fn){middleware=fn;}}});
  const request=(url,method="GET")=>{
    const result={headers:{},next:false};
    const response={setHeader(key,value){result.headers[key]=value;},end(data){result.data=data;result.status=this.statusCode;}};
    middleware({url,method},response,error=>{assert.ifError(error);result.next=true;});
    return result;
  };
  const model=request("/product/maps/scene/models/uav.gltf?v=1");
  assert.equal(model.next,false);
  assert.equal(model.headers["Content-Type"],"model/gltf+json");
  assert.equal(JSON.parse(model.data).asset.version,"2.0");
  const head=request("/product/maps/scene/models/uav.gltf","HEAD");
  assert.equal(head.data,undefined);assert.equal(head.headers["Content-Length"],model.data.length);
  for(const url of ["/maps/scene/models/uav.gltf","/product/maps/scene/../package.json","/product/maps/scene/%2e%2e/package.json","/product/maps/scene/missing"])
    assert.equal(request(url).next,true,url);
  assert.equal(request("/product/maps/scene/%invalid").status,400);
  assert.equal(request("/product/maps/scene/models/uav.gltf","POST").next,true);
  const assets=new Map();
  plugin.generateBundle.call({emitFile(asset){assets.set(asset.fileName,asset.source);}});
  assert.deepEqual(assets.get("maps/scene/models/uav.gltf"),model.data);
  for(const name of ["maps/scene/geoid/egm96_15.gtx","maps/scene/geoid/NOTICE.txt","maps/cesium/LICENSE.md","maps/cesium/ThirdParty.json","maps/cesium/Workers/createGeometry.js","maps/cesium/Widgets/widgets.css"])
    assert.ok(assets.get(name)?.length,name);
});

test("invalid and overlapping asset paths fail before serving",()=>{
  for(const scenePath of ["../scene","/scene","scene/..","scene\\models","", "scene?x"])
    assert.throws(()=>uavMap3dAssets({scenePath}));
  assert.throws(()=>uavMap3dAssets({scenePath:"same",cesiumPath:"same"}));
  assert.throws(()=>uavMap3dAssets({scenePath:"same/scene",cesiumPath:"same"}));
});

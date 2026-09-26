import {readFileSync, readdirSync} from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const folders = ["Assets", "Workers", "ThirdParty", "Widgets"];
const notices = ["LICENSE.md", "ThirdParty.json", "ThirdParty.extra.json"];
const mime = {".js":"text/javascript", ".json":"application/json", ".gltf":"model/gltf+json",
  ".css":"text/css", ".wasm":"application/wasm", ".png":"image/png", ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg", ".svg":"image/svg+xml", ".gif":"image/gif", ".webp":"image/webp"};

function files(root) {
  return readdirSync(root, {withFileTypes:true}).flatMap(entry => {
    const filename = path.join(root, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
}
function outputPath(value) {
  if (!value || !/^[\w-]+(?:\/[\w-]+)*$/.test(value)) throw new Error("Asset paths must be relative directories without traversal.");
  return value;
}

/** Serve and emit local renderer assets and the installed Cesium peer's runtime. */
export function uavMap3dAssets({scenePath = "scene", cesiumPath = "cesium"} = {}) {
  outputPath(scenePath); outputPath(cesiumPath);
  if (scenePath === cesiumPath || scenePath.startsWith(`${cesiumPath}/`) || cesiumPath.startsWith(`${scenePath}/`)) {
    throw new Error("Scene and Cesium asset directories must be separate.");
  }
  const cesiumRoot = path.dirname(require.resolve("cesium/package.json"));
  const sceneRoot = fileURLToPath(new URL("../assets/", import.meta.url));
  const sources = [{root:sceneRoot, prefix:scenePath},
    ...folders.map(folder => ({root:path.join(cesiumRoot,"Build","Cesium",folder), prefix:`${cesiumPath}/${folder}`}))];
  const resources = new Map();
  for (const {root,prefix} of sources) for (const filename of files(root)) {
    resources.set(`${prefix}/${path.relative(root,filename).split(path.sep).join("/")}`,filename);
  }
  for (const notice of notices) resources.set(`${cesiumPath}/${notice}`,path.join(cesiumRoot,notice));
  let base = "/";
  return {
    name:"uav-map-3d-assets",
    configResolved(config) {base = config.base === "./" || config.base === "" ? "/" : config.base;},
    configureServer(server) {
      server.middlewares.use((req,res,next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        let url;
        try {url = decodeURIComponent((req.url || "").split("?")[0]);} catch {res.statusCode=400;res.end();return;}
        if (!url.startsWith(base)) return next();
        const filename = resources.get(url.slice(base.length));
        if (!filename) return next();
        try {
          const data = readFileSync(filename);
          res.setHeader("Content-Type",mime[path.extname(filename)] || "application/octet-stream");
          res.setHeader("Content-Length",data.length);
          res.end(req.method === "HEAD" ? undefined : data);
        } catch (error) {next(error);}
      });
    },
    generateBundle() {
      for (const [fileName,filename] of resources) this.emitFile({type:"asset",fileName,source:readFileSync(filename)});
    },
  };
}

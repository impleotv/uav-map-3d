import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../",import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run via npm run verify:package");
const require = createRequire(import.meta.url);
const run = (script,args,cwd=root) => {
  const result=spawnSync(process.execPath,[script,...args],{cwd,encoding:"utf8",maxBuffer:16*1024*1024});
  if (result.error || result.status!==0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
};
run(npm,["run","build"]);
mkdirSync(path.join(root,".cache"),{recursive:true});
const consumer=mkdtempSync(path.join(root,".cache","consumer-"));
const [packed]=JSON.parse(run(npm,["pack","--json","--pack-destination",consumer]));
const names=new Set(packed.files.map(file=>file.path));
for(const name of ["dist/index.js","dist/index.d.ts","dist/models.d.mts","dist/orientation.d.mts","dist/vite.mjs","dist/vite.d.mts","dist/styles.css","assets/geoid/NOTICE.txt","assets/geoid/egm96_15.gtx","NOTICE.md"])
  assert.ok(names.has(name),`Missing packed file ${name}`);
assert.ok(![...names].some(name=>name.startsWith("src/") || name.startsWith("test/")));
writeFileSync(path.join(consumer,"package.json"),JSON.stringify({private:true,type:"module"}));
run(npm,["install","--ignore-scripts","--no-audit","--no-fund",path.join(consumer,packed.filename),"cesium@1.145.0"],consumer);
mkdirSync(path.join(consumer,"sample"));
for(const name of ["index.html","main.ts","assets.d.ts"]) copyFileSync(path.join(root,"sample",name),path.join(consumer,"sample",name));
writeFileSync(path.join(consumer,"vite.config.mjs"),'import {uavMap3dAssets} from "@impleotv-pm/uav-map-3d/vite";\nexport default {base:"./",plugins:[uavMap3dAssets()]};\n');
writeFileSync(path.join(consumer,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"ESNext",moduleResolution:"Bundler",strict:true,noEmit:true,skipLibCheck:true,lib:["ES2022","DOM"]},include:["sample/**/*.ts"]}));
run(path.join(path.dirname(require.resolve("typescript/package.json")),"bin/tsc"),["-p","tsconfig.json"],consumer);
const vite=path.join(path.dirname(require.resolve("vite/package.json")),"bin/vite.js");
run(vite,["build","sample","--config","vite.config.mjs"],consumer);
const output=path.join(consumer,"sample","dist");
for(const name of ["index.html","cesium/LICENSE.md","cesium/ThirdParty.json","cesium/ThirdParty.extra.json","cesium/Workers/createGeometry.js","cesium/ThirdParty/draco_decoder.wasm","cesium/ThirdParty/basis_transcoder.wasm","cesium/Widgets/widgets.css","cesium/Assets/approximateTerrainHeights.json","scene/geoid/NOTICE.txt"])
  assert.ok(existsSync(path.join(output,name)),`Missing consumer asset ${name}`);
assert.equal(createHash("sha256").update(readFileSync(path.join(output,"scene/geoid/egm96_15.gtx"))).digest("hex"),"c02a6eb70a7a78efebe5adf3ade626eb75390e170bb8b3f36136a2c28f5326a0");
for(const preset of ["uav","helicopter","quadcopter","camera"]) {
  const filename=path.join(output,`scene/models/${preset}.gltf`);
  const model=JSON.parse(readFileSync(filename));
  assert.equal(model.asset.version,"2.0");
  for(const item of [...model.buffers??[],...model.images??[]]) if(item.uri && !item.uri.startsWith("data:"))
    assert.ok(existsSync(path.resolve(path.dirname(filename),item.uri)));
}
console.log(`Packed package, declarations and standalone consumer assets verified: ${consumer}`);

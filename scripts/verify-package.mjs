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
const skillRoot="skills/uav-map-3d";
const skillDocs=["SKILL.md","references/setup.md","references/platforms-and-targets.md","references/map-configuration.md","references/react.md"];
for(const name of ["HOWTO.md",...skillDocs.map(name=>`${skillRoot}/${name}`)])
  assert.ok(names.has(name),`Missing packed skill/documentation file ${name}`);
assert.ok(names.has("CHANGELOG.md"), "Missing packed CHANGELOG.md");
assert.ok(names.has("dist/react/MapEditor.js"), "Missing packed MapEditor");
for(const name of ["dist/react/index.js","dist/react/index.d.ts","dist/react/PresentationEditor.js","dist/react/ModelPreview.js","dist/react/types.d.ts","dist/react/presentation.css","dist/index.js","dist/index.d.ts","dist/models.d.mts","dist/orientation.d.mts","dist/vite.mjs","dist/vite.d.mts","dist/styles.css","assets/geoid/NOTICE.txt","assets/geoid/egm96_15.gtx","NOTICE.md"])
  assert.ok(names.has(name),`Missing packed file ${name}`);
assert.ok(![...names].some(name=>name.startsWith("src/") || name.startsWith("test/")));
writeFileSync(path.join(consumer,"package.json"),JSON.stringify({private:true,type:"module"}));
run(npm,["install","--ignore-scripts","--no-audit","--no-fund",path.join(consumer,packed.filename),"cesium@1.145.0"],consumer);
mkdirSync(path.join(consumer,"sample"));
// Compile the actual bundled Markdown examples, so documentation cannot drift
// independently of a separate, hand-maintained example fixture.
const installedSkill=path.join(consumer,"node_modules/@impleotv-pm/uav-map-3d",skillRoot);
const skillExamples=[];
for(const doc of skillDocs) {
  const content=readFileSync(path.join(installedSkill,doc),"utf8");
  for(const [,href] of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if(/^(?:https?:|#)/.test(href)) continue;
    const target=path.posix.normalize(path.posix.join(skillRoot,path.posix.dirname(doc),href.split("#")[0]));
    assert.ok(target.startsWith(`${skillRoot}/`) && names.has(target),`Unbundled skill reference: ${doc} -> ${href}`);
  }
  for(const [index,match] of [...content.matchAll(/^```(ts|tsx)\r?\n([\s\S]*?)^```/gm)].entries()) {
    const [,extension,code]=match;
    skillExamples.push({name:`skill-${path.basename(doc,".md")}-${index}.${extension}`,code,extension});
  }
}
assert.ok(skillExamples.some(example=>example.extension==="ts"),"Missing renderer skill examples");
assert.ok(skillExamples.some(example=>example.extension==="tsx"),"Missing React skill example");
for(const example of skillExamples.filter(example=>example.extension==="ts"))
  writeFileSync(path.join(consumer,"sample",example.name),example.code);
writeFileSync(path.join(consumer,"sample/skill-renderer.html"),`<!doctype html>
<html><head><title>Skill renderer example</title></head><body>
<div id="scene" style="width:100%;height:480px"></div>
<script type="module">
import {mountScene} from './skill-setup-0.ts';
import {updateAircraft} from './skill-platforms-and-targets-0.ts';
import {applyOfflineMap} from './skill-map-configuration-0.ts';
const mounted=mountScene(document.querySelector('#scene'));
const remove=updateAircraft(mounted.scene);
applyOfflineMap(mounted.scene).catch(console.error);
window.addEventListener('pagehide',()=>{remove();mounted.dispose();},{once:true});
</script></body></html>`);
for(const name of ["index.html","main.ts","assets.d.ts"]) copyFileSync(path.join(root,"sample",name),path.join(consumer,"sample",name));
writeFileSync(path.join(consumer,"vite.config.mjs"),'import {fileURLToPath} from "node:url";\nimport {uavMap3dAssets} from "@impleotv-pm/uav-map-3d/vite";\nexport default {base:"./",plugins:[uavMap3dAssets()],build:{rollupOptions:{input:["index.html","skill-renderer.html"].map(name=>fileURLToPath(new URL("./sample/"+name,import.meta.url)))}}};\n');
writeFileSync(path.join(consumer,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"ESNext",moduleResolution:"Bundler",strict:true,noEmit:true,skipLibCheck:true,lib:["ES2022","DOM"]},include:["sample/**/*.ts"]}));
run(path.join(path.dirname(require.resolve("typescript/package.json")),"bin/tsc"),["-p","tsconfig.json"],consumer);
const vite=path.join(path.dirname(require.resolve("vite/package.json")),"bin/vite.js");
run(vite,["build","sample","--config","vite.config.mjs"],consumer);
const output=path.join(consumer,"sample","dist");
assert.ok(existsSync(path.join(output,"skill-renderer.html")));
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

// The renderer-only consumer does not install the optional React peer.
assert.ok(!existsSync(path.join(consumer,"node_modules/react")));
run(npm,["install","--ignore-scripts","--no-audit","--no-fund","react@19.3.0","react-dom@19.3.0","@types/react@19.3.0","@types/react-dom@19.3.0"],consumer);
for(const example of skillExamples.filter(example=>example.extension==="tsx"))
  writeFileSync(path.join(consumer,"sample",example.name),example.code);
writeFileSync(path.join(consumer,"sample/skill-react-main.tsx"),`import {createRoot} from "react-dom/client";
import {Settings} from "./skill-react-0";
const root=createRoot(document.getElementById("settings")!);
root.render(<Settings publicBase={document.baseURI} onSave={() => {}} />);
window.addEventListener("pagehide",()=>root.unmount(),{once:true});
`);
writeFileSync(path.join(consumer,"sample/skill-react.html"),'<!doctype html><html><head><title>Skill React example</title></head><body><div id="settings"></div><script type="module" src="./skill-react-main.tsx"></script></body></html>');
for(const name of ["presentation.html","presentation.tsx"]) copyFileSync(path.join(root,"sample",name),path.join(consumer,"sample",name));
writeFileSync(path.join(consumer,"sample/map-contract.ts"),`import {MapEditor, mapConfigError, type MapEditorProps} from "@impleotv-pm/uav-map-3d/react";
import type {MapConfig} from "@impleotv-pm/uav-map-3d";
const value: MapConfig = {ion:{accessToken:"",worldTerrain:true,osmBuildings:true,bingAerial:true,googlePhotorealistic:true}};
const props: MapEditorProps = {value,onChange:()=>{}};
export const contract = {MapEditor, props, error:mapConfigError(value)};
`);
writeFileSync(path.join(consumer,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"ESNext",moduleResolution:"Bundler",jsx:"react-jsx",strict:true,noEmit:true,skipLibCheck:true,lib:["ES2022","DOM"]},include:["sample/**/*.ts","sample/**/*.tsx"]}));
run(path.join(path.dirname(require.resolve("typescript/package.json")),"bin/tsc"),["-p","tsconfig.json"],consumer);
writeFileSync(path.join(consumer,"vite.config.mjs"),'import {fileURLToPath} from "node:url";\nimport {uavMap3dAssets} from "@impleotv-pm/uav-map-3d/vite";\nexport default {base:"./",plugins:[uavMap3dAssets()],build:{rollupOptions:{input:["presentation.html","skill-react.html"].map(name=>fileURLToPath(new URL("./sample/"+name,import.meta.url)))}}};\n');
run(vite,["build","sample","--config","vite.config.mjs"],consumer);
assert.ok(existsSync(path.join(output,"presentation.html")));
assert.ok(existsSync(path.join(output,"skill-react.html")));
console.log("Optional React consumer types and production UI build verified.");
console.log("Bundled skill references and renderer/React examples verified against the packed library.");

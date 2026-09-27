import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
function renderTree(Component,props) {
  let tree;
  function Capture(){tree=Component(props);return null;}
  renderToStaticMarkup(createElement(Capture));return tree;
}
import assert from "node:assert/strict";
test("presentation import delegates picker ownership to its host",async()=>{
  const {createServer}=await import("vite");
  const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
  try{
    const {MapEditor,mapConfigError}=await server.ssrLoadModule("/dist/react/MapEditor.js");
    const mapNodes=[];
    const walk=node=>{if(!node||typeof node!=="object")return;if(Array.isArray(node)){node.forEach(walk);return;}mapNodes.push(node);walk(node.props?.children);};
    let nextMap;
    const mapValue={terrainUrl:"local",ion:{accessToken:"",worldTerrain:false}};
    walk(renderTree(MapEditor,{value:mapValue,onChange:value=>{nextMap=value;}}));
    const token=mapNodes.find(n=>n.type==="input"&&n.props.type==="password");
    assert.ok(token);token.props.onChange({target:{value:"user-token"}});
    assert.equal(nextMap.ion.accessToken,"user-token");assert.equal(nextMap.terrainUrl,"local");assert.equal(mapValue.ion.accessToken,"");
    const toggles=mapNodes.filter(n=>n.type==="input"&&n.props.type==="checkbox");
    assert.ok(toggles.every(n=>!n.props.checked),"all options start off");
    assert.equal(toggles.length,5,"offline and four optional online layers");
    toggles[4].props.onChange({target:{checked:true}});
    assert.equal(nextMap.ion.googlePhotorealistic,true);assert.ok(mapConfigError(nextMap));
    assert.equal(toggles[1].props.disabled,true,"custom terrain wins");
    toggles[2].props.onChange({target:{checked:true}});
    assert.ok(mapConfigError(nextMap));
    assert.equal(mapConfigError({...nextMap,offline:true}),"");
    mapNodes.length=0;
    walk(renderTree(MapEditor,{value:{...nextMap,offline:true},onChange:()=>{}}));
    assert.ok(mapNodes.filter(n=>n.type==="input").slice(1).every(n=>n.props.disabled));
    const {ModelEditor:PresentationEditor}=await server.ssrLoadModule("/dist/react/PresentationEditor.js");
    const imports=[],changes=[];
    const models=[
      {id:"bundled:Zebra.gltf",name:"Zebra",bundled:true},{id:"bundled:Heron.glb",name:"Heron",bundled:true},{id:"imported-id",name:"Local aircraft"},
      {id:"heron-copy-1",name:"Heron.glb"},{id:"heron-copy-2",name:" HERON.GLB "},
      {id:"local-copy",name:"Local aircraft"},
    ];
    const tree=PresentationEditor({value:{preset:"uav",scale:1},onChange:value=>changes.push(value),onImport:kind=>imports.push(kind),models});
    const nodes=[];
    const visit=node=>{if(!node||typeof node!=="object")return;if(Array.isArray(node)){node.forEach(visit);return;}nodes.push(node);visit(node.props?.children);};
    visit(tree);
    assert.equal(nodes.some(node=>node.type==="input"&&node.props.type==="file"),false,"embedded CEF must not own the model picker");
    const button=nodes.find(node=>node.type==="button"&&node.props.children?.includes?.("Upload"));
    assert.ok(button);button.props.onClick();
    assert.deepEqual(imports,["model"]);
    const groups=nodes.filter(node=>node.type==="optgroup");
    assert.deepEqual(groups.map(node=>node.props.label),["Bundled models","Uploaded models"]);
    assert.equal(groups[0].props.children[0].props.value,"bundled:Heron.glb");
    assert.deepEqual(groups[0].props.children.map(option=>option.props.children),["Heron","Zebra"]);
    assert.equal(groups[1].props.children[0].props.value,"imported-id");
    assert.equal(groups[1].props.children.length,1,"repeated uploads and bundled names appear only once");
    const selector=nodes.find(node=>node.type==="select"&&node.props.value==="");
    assert.equal(selector.props.children[0].props.children,"Aircraft");
    selector.props.onChange({target:{value:"bundled:Heron.glb"}});
    assert.equal(changes[0].modelAssetId,"bundled:Heron.glb");
    assert.equal(changes[0].preset,"uav");
    nodes.length=0;
    visit(PresentationEditor({value:{preset:"uav",scale:1,modelAssetId:"heron-copy-2"},models}));
    const modelSelect=nodes.find(node=>node.type==="select"&&node.props.value==="heron-copy-2");
    assert.ok(modelSelect);
    const options=nodes.filter(node=>node.type==="option"&&models.some(model=>model.id===node.props.value));
    assert.equal(options.length,3);
    assert.equal(options.filter(node=>/heron/i.test(node.props.children)).length,1);
    assert.ok(options.some(node=>node.props.value==="heron-copy-2"),"a saved duplicate selection remains selected");
    nodes.length=0;
    const value={preset:"camera",scale:1,headingOffset:0,pitchOffset:0,rollOffset:0};
    visit(PresentationEditor({value,onChange:next=>changes.push(next),showPreview:false}));
    assert.equal(nodes.some(node=>node.type==="button"),false,"upload is optional and preview can be disabled");
    const name=nodes.find(node=>node.type==="input"&&node.props.maxLength===256);
    assert.equal(name.props.placeholder,"Automatic");
    assert.ok(!JSON.stringify(nodes.map(node=>node.props.title)).includes("KLV"));
    const scale=nodes.find(node=>node.type==="input"&&node.props.type==="number");
    scale.props.onChange({target:{value:""}});
    assert.equal(changes.at(-1).scale,"","empty numeric input is retained as an editable draft");
    assert.equal(value.scale,1,"controlled editing never mutates the supplied value");
    const fixed=nodes.find(node=>node.type==="label"&&node.props.children?.includes?.("Use fixed position when telemetry is absent"));
    fixed.props.children[0].props.onChange({target:{checked:true}});
    assert.deepEqual(changes.at(-1).fixedPosition,{latitude:0,longitude:0,height:0});
    nodes.length=0;
    visit(PresentationEditor({value,onChange:()=>{},namePlaceholder:"Host name",nameHelp:"Host-specific explanation",busy:true,error:"Cannot save",showPreview:false}));
    assert.equal(nodes.find(node=>node.type==="fieldset").props.disabled,true);
    assert.equal(nodes.find(node=>node.type==="input"&&node.props.maxLength===256).props.placeholder,"Host name");
    assert.equal(nodes.find(node=>node.props.role==="alert").props.children,"Cannot save");
  }finally{await server.close();}
});

import {mkdirSync, readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const {version} = JSON.parse(readFileSync("package.json", "utf8"));
const destination = `.cache/releases/${version}`;
mkdirSync(destination, {recursive: true});
if (!process.env.npm_execpath) throw new Error("Run the release through npm or Make.");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "pack", "--pack-destination", destination], {stdio: "inherit"});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

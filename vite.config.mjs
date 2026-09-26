import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import {uavMap3dAssets} from "./src/vite.mjs";
export default defineConfig({root:"sample",base:"./",plugins:[uavMap3dAssets()],build:{rollupOptions:{input:{scene:fileURLToPath(new URL("./sample/index.html",import.meta.url)),presentation:fileURLToPath(new URL("./sample/presentation.html",import.meta.url))}},outDir:"../sample-dist",emptyOutDir:true,chunkSizeWarningLimit:1200}});

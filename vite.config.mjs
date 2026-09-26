import {defineConfig} from "vite";
import {uavMap3dAssets} from "./src/vite.mjs";
export default defineConfig({root:"sample",base:"./",plugins:[uavMap3dAssets()],build:{outDir:"../sample-dist",emptyOutDir:true,chunkSizeWarningLimit:1200}});

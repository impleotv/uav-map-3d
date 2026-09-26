export type AssetOptions = {scenePath?: string; cesiumPath?: string};
/** Vite-compatible plugin; importing the renderer never imports this Node-only entry. */
export declare function uavMap3dAssets(options?: AssetOptions): {
  name: string;
  configResolved(config: {base: string}): void;
  configureServer(server: {middlewares: {use(handler: (...args: any[]) => void): void}}): void;
  generateBundle(this: {emitFile(asset: {type: "asset"; fileName: string; source: Uint8Array}): unknown}): void;
};

# Setup and lifecycle

Install the library separately from the skill, using the application's approved
package source and a published tag or supplied archive. For Git installations,
use `github:impleotv/uav-map-3d#<published-tag>`; replace the placeholder with an
existing release. Existing Git credentials handle private access. Do not put
tokens in dependency URLs. Git installs build through the package's prepare step.

Read the installed package's peerDependencies. The source revision accompanying
this skill requires Cesium 1.145.0; renderer-only consumers do not require React.
The current development toolchain requires Node 22.21+ on 22.x, or Node 24+.

## Vite

Add the public asset plugin to the host's existing Vite configuration:

```js
import {defineConfig} from "vite";
import {uavMap3dAssets} from "@impleotv-pm/uav-map-3d/vite";

export default defineConfig({base: "./", plugins: [uavMap3dAssets()]});
```

It serves development assets and emits `scene/` and `cesium/` in production.
Optional `scenePath` and `cesiumPath` select distinct relative output directories.
Derive runtime URLs from the deployment base, not a nested client-side route.
The example below assumes document.baseURI is the deployment root; for SPA routes,
pass a root URL derived from the host's configured public base instead.

## Minimal browser scene

Create a container with a nonzero width and height (for example, 100% by 480px),
then call this function after it is mounted:

```ts
import {Scene} from "@impleotv-pm/uav-map-3d";
import "@impleotv-pm/uav-map-3d/styles.css";

export function mountScene(container: HTMLElement, publicBase = document.baseURI) {
  const scene = new Scene(container, {
    assetBaseUrl: new URL("scene/", publicBase).href,
    cesiumBaseUrl: new URL("cesium/", publicBase).href,
    onError: message => console.error(message),
  });
  const resize = new ResizeObserver(() => scene.viewer.resize());
  resize.observe(container);
  return {
    scene,
    dispose() {
      resize.disconnect();
      scene.destroy();
    },
  };
}
```

The host calls `dispose()` on unmount, after stopping its own telemetry updates.
Construction requires a browser with WebGL; do not construct in SSR/module scope.
The root JavaScript entry can be imported in Node tests, but CSS needs bundler
support. All viewers on a page must use the same `cesiumBaseUrl`: Cesium's resource
base is process-wide. Keep provider credits visible.

## Other bundlers

Bundle the library and its CSS. Copy the package's `assets/` contents to
`assetBaseUrl`, and Cesium's `Build/Cesium/{Assets,Workers,ThirdParty,Widgets}`
directories to `cesiumBaseUrl`. Copy Cesium's `LICENSE.md`, `ThirdParty.json`, and
`ThirdParty.extra.json` there too. Both base URLs must end with `/`. Serve JS,
CSS, JSON, and WASM with appropriate MIME types, and retain third-party notices.

## Public entry points

- Root: `Scene`, input/configuration types, frustum and target style helpers.
- `/models`: model presets, defaults, validation, and presentation resolution;
  this entry does not load Cesium.
- `/orientation`: model orientation helper for host-owned Cesium previews.
- `/react`: optional controlled editors and lazy model preview.
- `/vite`: Node-only asset plugin; never import it into browser code.
- `/styles.css`, `/react/styles.css`, `/assets/*`: styling and runtime resources.

For blank scenes, first check container dimensions, CSS, WebGL errors, and resource
URLs in the browser. Verify a production build under the actual deployment base,
including workers, model files, and the EGM96 grid for MSL positions.

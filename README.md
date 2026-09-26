# UAV Map 3D

Framework-neutral browser library for UAV platforms, camera footprints, terrain,
imagery and detection targets. The renderer consumes normalized data, runs on
Cesium, and has no React, STView, backend, playback or MISB dependency.

## Install

```sh
npm install github:impleotv/uav-map-3d#v0.2.0 cesium@1.145.0
```

The package name is `@impleotv-pm/uav-map-3d`. Git installs compile the source
through `prepare`; consumers receive ES modules and TypeScript declarations.
Node 22.12 or later is recommended for the bundled development tools. The
renderer requires the tested Cesium 1.145.0 peer so the application and
renderer use one Cesium instance. Git access uses your existing credentials;
never embed a token in dependency URLs.

## Vite integration

```js
import {defineConfig} from "vite";
import {uavMap3dAssets} from "@impleotv-pm/uav-map-3d/vite";
export default defineConfig({base:"./",plugins:[uavMap3dAssets()]});
```

The plugin serves assets during development and emits `scene/` and `cesium/`
directories in production. Optional `scenePath` and `cesiumPath` select distinct
relative output directories. Vite's deployment base is supported.

```ts
import {Scene, type Platform} from "@impleotv-pm/uav-map-3d";
import "@impleotv-pm/uav-map-3d/styles.css";

const scene = new Scene(document.querySelector<HTMLElement>("#scene")!, {
  assetBaseUrl: new URL("scene/",document.baseURI).href,
  cesiumBaseUrl: new URL("cesium/",document.baseURI).href,
  onSelect: id => console.log("Selected",id),
  onError: console.error,
});
const platform: Platform = {
  id:"aircraft-1",sourceId:"feed-1",name:"Aircraft 1",timestamp:null,
  position:{latitude:32,longitude:34.8,height:1000,reference:"ellipsoid"},
  attitude:{heading:90,pitch:0,roll:0},
  sensor:{heading:0,pitch:-60,roll:0},
  fov:{horizontal:35,vertical:25},frameCenter:null,range:null,
};
scene.upsertPlatforms([platform]);
scene.select(platform.id);
scene.setCameraMode("follow");
// When unmounting: scene.destroy();
```

Give the container a nonzero width and height. Import the stylesheet explicitly;
the JavaScript entry can also be imported by Node-based tests without loading CSS
or creating a viewer. Renderer construction requires a browser with WebGL.
Call `scene.viewer.resize()` after changing container dimensions.

`upsertPlatforms` adds or updates supplied IDs; it does not remove omitted IDs.
Call `removePlatform(id)` or `resetSource(sourceId)` explicitly. Each Scene owns
its platforms and selection. Multiple viewers in one page must use the same
`cesiumBaseUrl`, because Cesium's resource base is process-wide.

## Public entry points

- Root: `Scene`, normalized data/configuration types, `defaultFrustumStyle`,
  `normalizeFrustumStyle`.
- `/models`: preset labels, defaults, layered resolution, validation, display
  names and URL resolution. This lightweight entry does not load Cesium.
- `/react`: optional controlled `PresentationEditor`, lazy `ModelPreview`, and component types.
- `/react/styles.css`: scoped editor styles (also imported by the components).
- `/orientation`: `modelOrientation` for a host's Cesium model preview.
- `/styles.css`: Cesium widget styles; preserve CSS during bundling.
- `/vite`: Node-only runtime asset plugin.
- `/assets/*`: four original model presets and the EGM96 geoid dataset.

The host resolves custom model URLs; `modelAssetId` is an opaque host identifier.
The host also owns metadata decoding, live/stale state, playback, persistence,
provider selection, offline access policy and user interface. Standard Cesium
credits are retained; any product branding belongs to its host application.
See [RENDERER.md](RENDERER.md) for camera, geometry, units and validity semantics.

## Optional React configuration UI

Install React 18 or 19 in the host application. The root renderer does not import
React; only the `/react` entry requires it. See [REACT.md](REACT.md) for controlled
values, model imports, preview customization, and styling.

## Other bundlers and static hosting

Bundle the JavaScript and stylesheet with your normal application toolchain.
Copy this package's `assets/` contents to `assetBaseUrl`. Copy Cesium's
`Build/Cesium/{Assets,Workers,ThirdParty,Widgets}` folders to `cesiumBaseUrl`, and
copy its `LICENSE.md`, `ThirdParty.json` and `ThirdParty.extra.json` there too.
Serve JS, CSS, JSON and WASM with their corresponding content types. URLs must
end with `/`; all resources can be hosted locally. No ion account or CDN is
required. Offline hosts must supply local imagery/terrain or leave them unset.

## Development and verification

```sh
npm ci
npm test
npm run typecheck
npm run verify:package
npm run sample
npm run sample:build
npm run sample:preview
```

The standalone sample runs ten platforms and 500 targets at 10 Hz using local
assets. `verify:package` installs a packed tarball in an isolated consumer,
checks its declarations, builds the samples and validates emitted resources. It first
verifies a renderer-only install without React, then installs React and checks the UI consumer.
The linked `presentation.html` example demonstrates editing and preview mount/unmount
under React Strict Mode without any STView code or backend.
Scratch consumers remain in ignored `.cache/` for inspection.

To test edits in STView, run `npm pack` here, then from its `frontend/` directory:

```sh
npm install --no-save --package-lock=false C:/Work/uav-map-3d/impleotv-pm-uav-map-3d-0.2.0.tgz
```

Repack and reinstall after changes. This avoids linked packages resolving a
second Cesium instance. `npm ci` restores STView's committed Git dependency;
its normal CMake build runs `npm ci` as well. Do not commit a local file dependency.

## Release

Update the package version and lockfile, run the checks above, commit the library,
and push an immutable `v<version>` Git tag to `impleotv/uav-map-3d`. Consumers pin
that tag and commit their generated lockfiles. No npm registry publication is
required. Source uses `UNLICENSED` metadata; asset/dependency notices are in
[NOTICE.md](NOTICE.md).

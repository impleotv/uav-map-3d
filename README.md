# UAV Map 3D

Framework-neutral browser library for UAV platforms, camera footprints, terrain,
imagery and detection targets. The renderer consumes normalized data, runs on
Cesium, and has no React, STView, backend, playback or MISB dependency.

## Install

For AI-assisted integration, see [Skills](HOWTO.md#skills) for installing the
library's portable agent skill from GitHub or the bundled package.

```sh
npm install github:impleotv/uav-map-3d#v0.4.0 cesium@1.145.0
```

The package name is `@impleotv-pm/uav-map-3d`. Git installs compile the source
through `prepare`; consumers receive ES modules and TypeScript declarations.
Use Node 22.21+ (22.x) or Node 24+ for the bundled development and release tools. The
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
  targetLocation:{latitude:32,longitude:34.806,height:125,reference:"msl"},
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
`targetLocation` is the normalized MISB ST 0601 tags 40–42 location. It draws a
default-enabled red crosshair and dashed line from the platform. Use
`configureModel(id, {...presentation, showTarget:false})` to hide it, or set
`targetStyle` to change its shared color, line width, and crosshair size.
Call `removePlatform(id)` or `resetSource(sourceId)` explicitly. Each Scene owns
its platforms and selection. Multiple viewers in one page must use the same
`cesiumBaseUrl`, because Cesium's resource base is process-wide.

## Optional Cesium online content

Pass a Cesium ion token with access to the selected assets:

```ts
await scene.configureMap({
  ion: {
    accessToken: "YOUR_CESIUM_ION_TOKEN",
    worldTerrain: true,
    osmBuildings: true,
    bingAerial: true,
    googlePhotorealistic: false, // Optional Google Photorealistic 3D Tiles
  },
});
// Disable online layers and return to the ellipsoid globe:
await scene.configureMap({offline: true});
```

All four options default to off and can be selected independently. Each call
replaces the map configuration. Custom `terrainUrl` and `imageryUrl` take
precedence over the corresponding ion options. `offline: true` suppresses ion
content; the host must ensure any explicit URLs point to local resources.
Tokens are passed per scene without changing Cesium's global token. Use a
browser token restricted to the required assets and application URLs; the
renderer does not persist it. Service failures are reported through `onError`
and do not prevent other layers from loading. Cesium credits remain visible.

World Terrain (asset 1), OSM Buildings (96188), and Bing Aerial (2) require
Cesium ion access and applicable asset entitlements. Coverage and resolution
vary by location. Buildings are a visual layer; sensor footprints and target
projection continue to intersect the terrain surface, not building roofs.

`googlePhotorealistic: true` loads Google Photorealistic 3D Tiles (asset
2275207) using the same token. Enable this asset in the user's ion account and
grant the token access. Once loaded, Google hides the visible globe and OSM
buildings to avoid overlapping surfaces; disabling it restores the configured
map. Offline mode disables Google as well. Initialization failure keeps the
configured map visible. Sensor projections still use the existing terrain or
ellipsoid calculations, not Google's mesh; ground overlays can be obscured by
the photorealistic surface. Standard provider credits are retained.

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

Releases use [release-it](https://github.com/release-it/release-it) and its
[Conventional Changelog plugin](https://github.com/release-it/conventional-changelog).
Install dependencies with `npm ci`, and have GNU Make and Git available. Sign in
once with `gh auth login` (or set `GITHUB_TOKEN` to a token with repository
contents write access), and configure Git credentials for pushing. Commit your changes on a
branch with an upstream, then run:

```sh
make release-preview
make release
```

Use Conventional Commits for new changes:

- `feat: add terrain mode` → minor release, under Features.
- `fix: correct camera heading` → patch release, under Bug Fixes.
- `chore: update tooling` → Maintenance entry, with no release on its own.
- `feat!: change scene API` or a `BREAKING CHANGE:` footer → major release.

Scopes such as `fix(camera): ...` are supported. Documentation, refactoring,
tests, build and CI changes are also listed without triggering a version bump.
The highest applicable bump wins. Nonconventional messages are omitted unless
they carry a recognized breaking-change footer. Existing historical entries
are preserved. For a maintenance-only release or an explicit override, use
`make release VERSION=patch` or `make release VERSION=0.3.0`.

The preview shows the version, grouped notes and planned commands without
changing files or publishing; it uses local history, so fetch tags first if
needed. The release requires a clean working tree, updates the package version,
lockfile and [CHANGELOG.md](CHANGELOG.md), then runs tests, type checks and
packed-consumer verification. After validation it commits the release, creates
`v<version>`, pushes the branch and tags atomically, and publishes a GitHub release.
The package tarball and full changelog are attached, and the changelog is included
inside the package. GitHub release notes use the generated entry. No version is
released automatically when there are only maintenance changes.

If a release fails, inspect the local commit/tag and GitHub draft before retrying;
do not move a published tag. See release-it's
[recovery options](https://github.com/release-it/release-it/blob/main/docs/github-releases.md#update-the-latest-release)
for completing an existing release without incrementing again.

Without Make, use `npm run release` or `npm run release -- --preview`, optionally
adding a version/bump argument. Consumers pin the Git tag and commit their
generated lockfiles. No npm registry publication is performed. Source uses
`UNLICENSED` metadata; asset/dependency notices are in [NOTICE.md](NOTICE.md).

# Independent 3D presentation

`src/Scene.ts` is a framework-neutral Cesium renderer. It has no STView bridge,
backend, React, persistence, or MISB dependency. `src/types.ts` defines its public
input. STView owns its `sceneTelemetry.mjs` adapter and `SceneWindowApp.jsx` orchestration.

```ts
import {Scene} from "@impleotv-pm/uav-map-3d";
import "@impleotv-pm/uav-map-3d/styles.css";

const scene = new Scene(container, {
  assetBaseUrl: new URL("scene/", document.baseURI).href,
  cesiumBaseUrl: new URL("cesium/", document.baseURI).href,
  onError: console.error,
});
scene.upsertPlatforms(platforms);
scene.configureModel(platforms[0].id, modelConfig);
scene.configureMap({ terrainUrl: "http://localhost:8000/terrain/" });
scene.select(platforms[0].id);
scene.setCameraMode("follow");
// On teardown:
scene.destroy();
```

All positions use longitude/latitude in degrees and height in metres. An omitted
height reference means WGS84 ellipsoid. `msl` means EGM96 MSL and requires the
bundled geoid grid. The renderer does not fabricate missing position or attitude.
The caller supplies validity as nullable groups and timestamp as a string or null.
Source reset and removal are explicit; the renderer does not own a playback clock.

Platform heading is clockwise from true north, pitch positive nose up, roll
positive right wing down. Sensor angles use the same forward/right/down axes
relative to the platform. Composition uses rotation matrices, not addition of
Euler angles. Model offsets use those body axes and never change sensor geometry.
glTF presets are +X forward, +Y up, +Z right before Cesium's Y-up conversion.
The entity orientation accounts for Cesium's additional Z-forward conversion:
after both loader conversions the authored nose is +Y, right is +X, and up is +Z.
Heading, pitch, and roll rotate these anatomical axes together. Model alignment
is composed in the body frame and does not affect sensor orientation.

`configureModel`, `removePlatform`, `resetSource`, `select`, `setCameraMode`, and
`fitAll` do not alter other platforms' input or video playback. IDs must be unique
within a scene. Model scale is physical; minimum pixel sizing keeps distant
platforms readable, so the on-screen model is not a measurement of aircraft size.

Negative platform heights are valid. On an ellipsoid-only map, a platform below
the surface is displayed at an approximate height above the target ground plane
when a ground reference is available. The same offset is applied to the frustum
origin; source telemetry is retained unchanged. If target elevation is missing,
reported target latitude/longitude and slant range can estimate the lower ground
intersection. Missing or inconsistent range does not invent an altitude.
Configured terrain continues to use the actual geodetic platform position.

Ground positions (`frameCenter` and `frameCorners`) may omit `height`; their
latitude/longitude still supplies a displayed ground location. These positions
do not imply a known elevation or a complete sensor orientation.

`configureFrustum({rays, groundOutline})` updates all existing and future platform
lines without resetting telemetry. Each style accepts `color` (`#RRGGBB`), `width`
(0.5–10 pixels), and `opacity` (0–1). Omitted values use defaults; invalid values
throw without changing the current style. Persistence belongs to the host.

Sensor mode uses `sensorCamera.mjs` to smooth camera position, quaternion
orientation with a frame-rate-independent 600 ms response. Lens tangents use
a separate 120 ms response so zoom stays responsive.
The camera settles at the latest sample without extrapolation. Selection/mode changes,
render gaps over one second, and position jumps over 10 km snap to the new pose.
Wheel input and `zoomSensor(factor)` adjust relative focal length (0.25–16×);
`resetSensorZoom()` restores telemetry FOV. Zoom does not alter telemetry or
footprints. Sensor input is removed when the viewer is destroyed.

`platformMotion.mjs` eases each entity's displayed position and model quaternion
with a 600 ms response, independently of the Sensor camera. Follow tracks the
eased entity; Free orbit does not change the camera. Rays start at the displayed
platform. `groundMotion.mjs` eases center/corner ground points with the same 600 ms
response in every mode. Rays, outline and fill share the displayed corner objects.
Intermediate points are projected onto loaded terrain/the ellipsoid so they do
not cut under the surface. Targets retain semantic corner indices; missing points
clear immediately and newly available points start at their reported position.
Ground easing continues even for stationary platforms and settles without extrapolation.
Raw entry positions and sensor axes remain unchanged. First placement, gaps over
one second, and jumps over 10 km snap; missing position clears the eased pose.

Reported `frameCenter` and optional four `frameCorners` take precedence for the
displayed ground footprint. Their latitude/longitude is projected onto the map
surface (loaded terrain, or the ellipsoid) so a flat globe does not visually
displace an elevated target. This display projection never changes sensor-camera
orientation or platform altitude. In ellipsoid-only mode, Sensor view translates
its camera by the same displacement as the reported frame center (or slant-range
endpoint). This preserves sensor roll and angular FOV while viewing the flat map
near the reported target, rather than overshooting elevated ground. Status marks
this viewpoint as approximate. Configured terrain uses the actual sensor position.
Without reported corners, FOV rays intersect configured terrain. In ellipsoid
mode they use a local plane at the reported frame-center elevation, or at the
slant-range endpoint when available, before projecting to the map surface.
Without either reference they use an analytic ellipsoid intersection. These
estimates are marked approximate. Frame-center-only metadata produces a direction
line, not a complete sensor camera. EGM96 interpolation is an approximation of
the vertical datum, not a replacement for local survey corrections.

`test/fixtures/truck.json` contains normalized geometry derived from the first KLV
packet of `Truck.ts` (PID 258, PTS 120.221056). The regression check verifies that
its 1,867 m MSL ground target is not extrapolated to a sea-level intersection.

The host resolves asset URLs and enforces offline provider selection. No ion
account is required. Serve Cesium Assets, Workers, ThirdParty, and Widgets at
`cesiumBaseUrl`; serve preset models and the EGM96 grid at `assetBaseUrl`.

Run `npm run sample` for the standalone
10-platform/500-target/10-Hz example. IDs change every ten seconds to exercise
pool reuse; the target checkbox exercises visibility. It reports update and
render timing, active/allocated slots and browser heap where available.
It uses bundled resources and no network map provider.
Run `npm run typecheck` and `npm test` for library checks. STView retains its adapter tests.

`Platform.targetFrame` optionally supplies a frame key, its own geometry and
normalized targets (ID, geographic center/boundary, unit-UV box/centroid).
`generation` separates source lifetimes. `configureTargets({visible})` defaults
to true; host configuration owns persistence. `targetStats` exposes collection
counts and cumulative CPU timings for diagnostics. STView MISB adaptation lives in
its `sceneVmti.mjs`, using the SDK snapshot's unmerged `packetFields`; missing support
leaves targets empty rather than treating retained detections as fresh.

`targetGeometry.mjs` solves one homography in a local tangent frame per footprint,
rejects non-convex/degenerate corners, and samples each outline edge in four
segments. A half-metre surface offset reduces depth flicker. `TargetLayer.mjs`
owns pooled Cesium polyline/point collections and one tooltip; no target entities,
per-target callbacks, or remote terrain requests are added. Pixel targets share
the displayed footprint smoothing when geometry agrees; their separate packet
geometry uses the same response otherwise. Reported locations need no aircraft.

Preset geometry is original Impleo artwork generated by
`scripts/generate_scene_models.py`. EGM96 provenance is in
`assets/geoid/NOTICE.txt`. Default Cesium branding, data-provider and model
credits remain visible. STView applies its own branding outside this library.

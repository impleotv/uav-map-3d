# Platforms and targets

Supply normalized `Platform` values through the public API. This example adds one
aircraft and a geographically located detection; invoke it with an existing Scene.

```ts
import type {Platform, Scene} from "@impleotv-pm/uav-map-3d";

export function updateAircraft(scene: Scene) {
  const platform: Platform = {
    id: "aircraft-1", sourceId: "feed-1", name: "Aircraft 1", timestamp: null,
    position: {latitude: 32, longitude: 34.8, height: 1000, reference: "ellipsoid"},
    attitude: {heading: 90, pitch: 0, roll: 0},
    sensor: {heading: 0, pitch: -60, roll: 0},
    fov: {horizontal: 35, vertical: 25},
    frameCenter: {latitude: 32, longitude: 34.806}, range: null,
    targetLocation: {latitude: 32.001, longitude: 34.805, height: 120, reference: "msl"},
  };
  platform.targetFrame = {
    key: "frame-1",
    geometry: {
      position: platform.position, attitude: platform.attitude,
      sensor: platform.sensor, fov: platform.fov,
      frameCenter: platform.frameCenter, range: platform.range,
    },
    targets: [{id: "detection-1", center: {latitude: 32, longitude: 34.806}}],
  };
  scene.upsertPlatforms([platform]);
  scene.select(platform.id);
  scene.setCameraMode("follow");
  return () => scene.removePlatform(platform.id);
}
```

In a real adapter, assign frame keys to detection frames and update them with new
frames. Keep each detection frame's geometry paired with that frame, rather than
substituting newer platform telemetry. `generation` distinguishes source lifetimes.
Use null/empty target data when detections are unavailable; do not retain old
detections and present them as fresh input.

## Coordinates and missing data

- Latitude/longitude and attitude/FOV angles are degrees; heights and ranges are
  metres. Omitted height reference means WGS84 ellipsoid. `msl` means EGM96 MSL
  and requires the bundled geoid grid. Negative heights are valid.
- Platform heading is clockwise from true north, pitch is positive nose up, and
  roll is positive right wing down. Sensor attitude is relative to the platform
  using forward/right/down axes. Compose rotations, not sums of Euler angles.
- Position, attitude, sensor, FOV, and frame center may be null. Ground positions
  can omit height. A ground location does not establish complete sensor attitude.
- Reported frame center and four corners take precedence for displayed footprints;
  otherwise the renderer estimates intersections from available geometry. Model
  alignment offsets change the model, not the sensor geometry.
- Target center/boundary can be geographic. Image-space boxes and centroids use
  unit UV coordinates, not raw pixel counts. Normalize using the source dimensions.
  Supply matching frame geometry for projection; do not invent missing corners.
- `targetLocation` is the distinct ST 0601 tags 40–42 crosshair location, not
  `frameCenter` (23–25) or a VMTI detection. Supply validated latitude/longitude
  and any reported height with its correct `reference`. When height is missing,
  omit it; the marker uses the visible map surface. An unavailable platform
  position still allows the marker, but not its connecting line.
- Terrain and ellipsoid intersections are approximations; building roofs and
  photorealistic tile meshes are not the sensor projection surface.

## Updates and presentation

`upsertPlatforms` adds/updates supplied IDs and does not remove omitted IDs. Use
`removePlatform(id)` or `resetSource(sourceId)` explicitly on removal/source reset.
IDs are unique within each scene. The host owns timestamps, stale state, and
playback; renderer interpolation does not replace the host's clock.

Camera modes are `orbit`, `follow`, and `sensor`. Select a platform before following
it. Sensor mode needs valid sensor geometry; `zoomSensor(factor)` and
`resetSensorZoom()` change view zoom without changing telemetry or footprints.

`configureModel(id, config)` applies presentation. Use `/models` defaults and
validation instead of rebuilding defaults. In versions supporting per-platform
`showVmtiTargets`, `showTarget`, `targetStyle`, and `frustum`, resolve legacy scene
settings, global presentation, source settings, and platform settings in that
order with `resolvePresentation`.
Missing fields inherit, while explicit false and zero must survive. The host
resolves custom model URLs and owns `modelAssetId` identifiers.

`showTarget` defaults to true and is independent of `showVmtiTargets`.
`targetStyle` accepts partial `color` (six-digit hex, red by default), `width`
(0.5–10 pixels, default 2) and `crosshairSize` (8–128 screen pixels, default
24). The color applies to the crosshair and dashed platform-to-target line.
Use `defaultTargetStyle` and `normalizeTargetStyle` from the public package
exports for host defaults and validation.

Scene-wide `configureTargets({visible})` and `configureFrustum(...)` are also
available. Avoid using a global visibility gate to undo resolved per-platform
choices. Changing appearance should not reset input data or host playback.

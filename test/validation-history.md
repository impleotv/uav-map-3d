# VMTI validation — 2026-09-26

Windows, Codex in-app Chromium browser, 1280 × 720 viewport, Vite development
build, ellipsoid ground and no imagery. `scene-example.html` runs ten moving
platforms with fifty targets each at a requested 10 Hz. Every ten seconds all
target IDs change. Both geographic and estimated placements are included.

After warm-up, the browser reported:

| Measurement | Observed |
| --- | --- |
| Input updates | 10.0 Hz |
| Rendering | 37–38 FPS |
| Whole update batch, rolling p95 | 13.2–13.7 ms |
| Last target-layer batch CPU time | 7.1–7.7 ms |
| Render interval, rolling p95 | 38.8–40.5 ms |
| Targets / allocated paired slots | 500 / 500 |
| Browser JS heap snapshots | 150 and 325 MiB |

These observations were taken at 820 and 920 batches, with repeated complete
target-ID replacement. Heap values include Cesium, models, development tools,
and transient allocations; they are not a target-only memory measurement or
proof of leak freedom. Each slot owns one polyline and one point primitive.

Visual checks confirmed solid green reported contours, dashed amber estimated
boxes, green location-only markers, hover ID/source/placement, pause retention,
and disappearance/reappearance through repeated visibility toggles. The initial
ellipsoid path spent excessive time asking the globe for terrain heights;
ellipsoid target projection now avoids that lookup entirely.

Automated coverage includes independent perspective projection, dateline and
invalid footprints, pixel conventions, geographic fields, packet freshness,
generation resets, scene rendering without aircraft position, sensor/FOV
fallback, visibility persistence and resource cleanup. Twenty successive
500-target ID replacements retain 500 slots, and removing all sources releases
all slots.

Frontend tests/type checking/build, backend tests, manual build, the MSVC Debug
SDK build, and `stview_sdk.klv_snapshot` pass. Full packaged-player playback,
terrain-server performance, Linux and macOS were not run. Reproduce development
integration against the modified SDK with the repository's `LIVE_SDK=1` flow;
older SDK snapshots omit `packetFields` and therefore produce no target layer.

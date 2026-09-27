---
name: uav-map-3d
description: Integrate @impleotv-pm/uav-map-3d into browser applications. Use when creating UAV scenes, supplying platform telemetry or detection targets, configuring terrain and imagery, or adding the library's optional React configuration editors.
---

# UAV Map 3D integration

Use the library's public package exports to build UAV scenes. The renderer is
framework-neutral and consumes normalized data; the host owns telemetry decoding,
source identities, playback, persistence, file selection, and asset URL resolution.

## Check the consumer first

Inspect the application's dependency manifest and lockfile, then the installed
`@impleotv-pm/uav-map-3d/package.json` and public declarations. Match Cesium to
the installed package's peer dependency and keep one Cesium instance. React is
optional and is needed only for the `/react` entry.

This skill follows the source revision with which it ships. A GitHub installation
can be newer than the consumer's library. Prefer the skill bundled with the
installed package when versions differ. Local snapshots can share a package
version, so also check the locked Git revision/archive and actual exports. Do not
assume a planned release exists or upgrade dependencies without the user's intent.

## Choose the relevant reference

- For dependencies, asset deployment, scene creation, and teardown, read
  [Setup](references/setup.md).
- For normalized telemetry, coordinates, footprints, camera modes, and detections,
  read [Platforms and targets](references/platforms-and-targets.md).
- For terrain, imagery, ion content, and offline behavior, read
  [Map configuration](references/map-configuration.md).
- For controlled configuration forms, light/dark themes, and model previews, read
  [React integration](references/react.md).

Read only the references needed for the task. Their examples use public imports
and require no library source checkout or other installed skills.

## Integration workflow

1. Reuse the host's framework, bundler, dependency pins, and data adapters.
2. Configure asset hosting and a nonzero scene container before constructing a
   `Scene` in the browser. Preserve stylesheet imports.
3. Normalize input to the installed public types. Represent missing geometry as
   null rather than fabricating attitude, coordinates, or fresh detections.
4. Keep update, removal, selection, settings, and teardown operations explicit.
   Route renderer errors to the host's existing error display.
5. Verify the consumer's typecheck and production build. In a browser, check
   assets load under its deployment base, updates render, explicit removal works,
   and unmounting releases the viewer. For offline use, inspect network requests.

Use the installed declarations as authority when an example or newer option
differs. In particular, `PresentationPanel`, `SceneConfigEditor`, and per-platform
`showVmtiTargets`/`frustum` settings must be checked before use in older releases.
Do not import private source modules or copy the renderer/editor implementation
into the consuming application.

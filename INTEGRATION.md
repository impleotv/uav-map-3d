# Shared configuration integration

STView and STInspector now import `PresentationEditor`, `PresentationPanel`, and
`SceneConfigEditor` from `@impleotv-pm/uav-map-3d/react`. Application adapters own
source identities, persistence, asset URLs and file selection. The package owns
the selectors, tabs, fields, validation, collapsible sections and action layout.

## Coordinated release

The next integration release is **v0.4.0**. Until publication, both application
manifests and lockfiles pin the identical repository-local archive:
`frontend/vendor/uav-map-3d-shared-config-2f5b04d8f523.tgz`.
Its SHA-256 is
`2f5b04d8f523ace560070915e5696792ee01c66fcb95000df62ccdb06438ba2a`.
The archive retains the source package's internal 0.2.0 version; its filename
and lockfile integrity identify the integration snapshot. Include the archive,
vendor README, manifest, and lockfile with each application's changes.

This replaces the earlier temporary `--no-save --package-lock=false` installation:
that override was lost when STView's native build ran `npm ci` and restored
v0.3.0, which lacks the new shared exports. Repository-local pins survive clean
installs and require neither a sibling checkout nor an unpublished Git tag.
STView's CMake dependency list also tracks the vendor directory.

1. Commit the library changes, including the new components and tests.
2. Run `node scripts/release.mjs 0.4.0 --preview` to inspect the existing release
   workflow. The preview has been verified; it does not publish or modify pins.
3. Publish with the existing `npm run release -- 0.4.0` workflow. It updates the
   package version and changelog, runs checks, packs assets, and publishes the tag
   and GitHub release. This step has not been executed.
4. In **both** application frontend directories, run:

   ```text
   npm install --save-exact @impleotv-pm/uav-map-3d@github:impleotv/uav-map-3d#v0.4.0
   ```

5. Remove the superseded vendor snapshot and commit each application's manifest
   and lockfile together with its integration changes. Verify `npm ci` and the
   production frontend build in both applications against the published pin
   before release.

## Compatibility

Existing presentation records may omit `showVmtiTargets` and `frustum`. Resolve
library defaults, legacy scene settings, global presentation, source settings,
and platform overrides in that order. Frustum styles merge individual fields.
No eager migration or platform override creation is needed. The existing
presentation endpoints persist the optional fields; the model JSON codecs retain
missing values, explicit `false`, and zero opacity. General Config saves preserve
presentation and its legacy fallback values.

Model import remains host-owned. The shared Config editor delegates folder
registration through an asynchronous callback and retains failed input for retry.

## Validation

- Library: unit and interaction tests, typecheck, and fresh packed renderer-only
  and React consumer verification.
- STView: frontend test chain, scene type contract, production frontend build,
  and full Go backend test suite. After pinning the snapshot, the native
  `stview_frontend` Release target passed with its own `npm ci` and production
  build. Scene typechecking and all seven presentation tests also passed again.
- STInspector: scene frontend tests, production frontend build, and scene Go
  service tests, including persistence and rollback. Clean installation and the
  production frontend build passed again with the pinned snapshot. The broader HTTP package
  could not build because this machine's `runtime/cgo` tool exits with status 2.
- Browser previews use each application's real presentation adapter and CSS,
  with fixture sources and local API responses, at normal and narrow widths.
  They do not constitute native CEF/Wails end-to-end playback coverage.

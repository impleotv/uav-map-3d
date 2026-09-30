# React integration

React is optional. Install a version allowed by the installed library's peer
dependencies (currently React 18 or 19); the host also supplies React DOM.
Use the `/react` entry for configuration controls and the root entry for Scene.
Configure asset hosting as described in Setup before enabling a model preview.

## Controlled settings example

The host provides the callbacks and decides how to validate, apply, and persist
drafts. This form does not create a scene or save settings while the user types.

```tsx
import {useState} from "react";
import type {MapConfig} from "@impleotv-pm/uav-map-3d";
import {PresentationEditor, MapEditor, mapConfigError,
  type PresentationDraft} from "@impleotv-pm/uav-map-3d/react";
import {presentationDefaults, presentationError} from "@impleotv-pm/uav-map-3d/models";

export function Settings({publicBase, themeMode, onSave}: {
  publicBase: string;
  themeMode: "light" | "dark";
  onSave: (presentation: PresentationDraft, map: MapConfig) => void;
}) {
  const [presentation, setPresentation] = useState<PresentationDraft>({...presentationDefaults});
  const [map, setMap] = useState<MapConfig>({offline: true});
  const error = presentationError(presentation) || mapConfigError(map);
  return <section data-uav3d-theme={themeMode}>
    <PresentationEditor value={presentation} onChange={setPresentation}
      assetBaseUrl={new URL("scene/", publicBase).href}
      cesiumBaseUrl={new URL("cesium/", publicBase).href}
      showPreview={false} />
    <MapEditor value={map} onChange={setMap} />
    {error && <p role="alert">{error}</p>}
    <button disabled={Boolean(error)} onClick={() => {
      if (!error) onSave(presentation, map);
    }}>Save</button>
  </section>;
}
```

Numeric drafts may contain `""`. Validate with `presentationError` before saving
or converting to a runtime model; validation is not a TypeScript type guard.
Do not cast unvalidated drafts to runtime types. The host's Save handler performs
its normal conversion/persistence and calls scene configuration methods.
Validate all fields, including fields on inactive editor tabs.

The editor emits complete new drafts. The host owns file selection, upload,
storage, and authenticated URLs. Supply `models`, `modelURL`, and `onImport` when
supporting custom models; omit `onImport` to hide Upload. IDs are opaque host
identifiers. Release host-created object URLs when no longer needed.

## Light and dark schemes

For revisions that include the theme stylesheet, set `data-uav3d-theme="light"`
or `data-uav3d-theme="dark"` on a wrapper around the shared controls, as above.
Nested editors inherit the palette; without a themed wrapper they default to
dark. This is a DOM attribute on the wrapper, not a React editor prop. Follow
the host application's selected scheme rather than inferring it independently
from the operating system.

Detached windows and iframes need the scheme at initialization and on subsequent
host theme changes, including while playback is paused. Pass it through the
host's existing trusted window bridge. React portals such as upload dialogs
need their own host theme context or styling because CSS variables follow DOM
ancestry rather than the React tree.

Customize the palette with `--uav3d-text-color`, `--uav3d-muted-color`,
`--uav3d-surface-background`, `--uav3d-input-background`,
`--uav3d-button-background`, `--uav3d-border-color`, and `--uav3d-accent-color`.
Preserve the stylesheet's native `color-scheme`, explicit foreground/background
colors for selects and options, and custom select appearance. Host toolbar
controls outside the editor need equivalent styling: Linux native dropdowns
can otherwise mix a light background with pale text.

Check the installed CSS as well as declarations: older packages can share the
same version number without these theme rules. The attribute alone cannot add
support to such a package. If retaining an older pin, a scoped stylesheet
backport can supply the theme rules without copying the React components; keep
it synchronized with the shared stylesheet until the dependency is upgraded.

Verify both schemes, disabled controls, focus indicators, and dropdown options
in the consuming UI. Browser checks on Windows do not establish native Linux
webview coverage.

## Preview and scene lifecycle

Set `showPreview` to true to enable the editor's lazy preview. Standalone
`ModelPreview` needs a React `Suspense` boundary. The preview owns its viewer,
resize observation, and disposal. Customization callbacks `onPreviewReady` or
`onReady` must not destroy that viewer and must tolerate Strict Mode recreation.
All viewers share the same Cesium base URL. Components import their own CSS;
preserve CSS imports and use the documented `--uav3d-*` properties for theming.

For a host-owned Scene, construct it after mounting in an effect, subscribe to
telemetry through the host adapter, and stop subscriptions/destroy the scene in
the effect cleanup. Do not construct a new Scene on every render. The configuration
editors do not own this host scene or its playback.

## Newer shared controls

Check installed exports/declarations before using these additions; a planned
release or unchanged local snapshot version does not prove availability:

- `PresentationPanel` supplies selection and Save/Reset/Close layout around the
  editor. The host supplies choices, selected key, and action callbacks.
- `SceneConfigEditor` supplies map content, advanced provider/asset options, and
  Save/Cancel. Validate `SceneConfigDraft` with `sceneConfigError`; the host resolves
  asset IDs and converts UI-specific fields to `MapConfig` before applying it.
- `onRegisterFolder(kind, path)` is a host callback returning a promise. A rejected
  registration retains the entered path for correction; the editor has no backend.
- Per-platform target visibility and frustum styles are controlled presentation
  settings; preserve missing values and false/zero when resolving inheritance.
- The Target tab controls `showTarget` and `targetStyle` for the separate ST 0601
  crosshair and dashed line; the VMTI tab controls detection targets. Validate
  drafts before saving, including Target fields on an inactive tab.

When these exports are absent, use the installed lower-level controls or discuss
an upgrade if the requested feature requires it. Do not assume unpublished APIs.

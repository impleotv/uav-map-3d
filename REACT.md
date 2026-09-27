# React configuration components

Import the controlled editor from the optional React entry point:

```tsx
import {useState} from "react";
import {PresentationEditor, type PresentationDraft} from "@impleotv-pm/uav-map-3d/react";
import {presentationDefaults, presentationError} from "@impleotv-pm/uav-map-3d/models";

export function Settings() {
  const [draft, setDraft] = useState<PresentationDraft>({...presentationDefaults});
  return <PresentationEditor
    value={draft}
    onChange={setDraft}
    assetBaseUrl={new URL("scene/", document.baseURI).href}
    cesiumBaseUrl={new URL("cesium/", document.baseURI).href}
  />;
}
```

The library supports React 18 and 19. React is an optional peer dependency;
applications using only the renderer do not install it. React DOM belongs to
the host application. Use the `/vite` asset plugin as described in README.md.

The form emits complete new values through `onChange` and never mutates its
input, saves settings, opens a file picker, uploads files, or reads application
storage. Numeric fields can temporarily contain `""`; `PresentationDraft`
expresses that state. Use `presentationError(draft)` before applying or saving
a draft. A valid `PresentationModel` remains compatible with the editor.
An invalid draft leaves the last valid preview intact while showing the error.

## Optional map content settings

Include `MapEditor` in the host's configuration dialog, or pass `mapConfig`
and `onMapConfigChange` to `PresentationEditor` to embed the same controls.
The four online layers start unchecked. A masked token field accepts the
user's own Cesium ion token. Offline mode disables online controls; custom
URLs take precedence over the corresponding online provider.
The Remove token button asks for confirmation, then clears the token and turns
off the online layers that require it. The host saves these changes through its
normal settings flow. Token removal is also available in offline mode.
Google Photorealistic 3D Tiles uses the same token and hides the visible globe
and OSM buildings once loaded. The editor explains this alongside the option.

```tsx
import {MapEditor, mapConfigError} from "@impleotv-pm/uav-map-3d/react";
// draft is a MapConfig; the host owns Save/Cancel and persistence.
<MapEditor value={draft} onChange={setDraft} busy={saving} />
// On Save, validate before applying:
if (!mapConfigError(draft)) await scene.configureMap(draft);
```

The editor neither stores the token nor requests online assets while typing.
Applying the configuration belongs to the host; the model preview does not
load map content. Avoid exposing the token in diagnostic dumps or logs.

## Model catalogs and imports

- `models`: `{id, name, bundled?}[]`; IDs are opaque host-owned identifiers.
  Matching names are grouped without replacing a saved selection's identity.
- `modelURL`: resolved URL for the selected custom model. The host handles
  authentication and resource hosting, including glTF companion resources.
- `onImport("model")`: optional host callback. Omitting it hides Upload.
  After a successful import, update `models`, `value.modelAssetId`, and
  `modelURL`. Revoke any host-created object URLs when they are no longer used.
- `busy` disables editing; `error` displays a host error above the preview.
- `namePlaceholder` and `nameHelp` customize automatic naming explanations.

The preset selector clears custom model selection. An unresolved selected model
shows a loading/unavailable message instead of displaying a different model.
There are no STView, KLV, stream/PID, or backend assumptions in the components.
Source identities, inheritance layers, persistence, and modal placement belong
to the host. Use the shared `PresentationPanel` for the selector and actions.

## Preview lifecycle and customization

`PresentationEditor` lazily imports Cesium only when its preview is mounted.
Set `showPreview={false}` to use the form without a viewer. The separately
exported `ModelPreview` is also lazy; render it inside React `Suspense`:

```tsx
<Suspense fallback={<p>Loading preview…</p>}>
  <ModelPreview config={draft} assetBaseUrl={assets} cesiumBaseUrl={cesium}
    onStatus={message => console.log(message)} />
</Suspense>
```

`onPreviewReady(viewer)` on the editor, or `onReady(viewer)` on ModelPreview,
allows host-specific viewer customization such as branding. The callback runs
after each viewer creation, including React Strict Mode recreation. It must not
destroy the viewer; the component owns resize observation and disposal. Changes
to callback identity do not recreate the viewer. Standard Cesium branding is
used unless the host changes it; Cesium's global credit/base-URL configuration
affects other viewers on the page. All viewers should share `cesiumBaseUrl`.

Changing model URL frames the new model. Scale/alignment edits preserve the
camera, and Reset view reframes it. Closing the editor or hiding its preview
disconnects resize observation and destroys the viewer and its resources.

## Styling

Components import their styles; preserve CSS imports in your bundler. Selectors
use the `uav3d-` prefix and do not style application panels. Text inherits its
host color and font. Override these CSS custom properties on a parent:

```css
.my-settings {
  --uav3d-input-background: #182734;
  --uav3d-button-background: #263d50;
  --uav3d-border-color: #496176;
  --uav3d-preview-height: 320px;
}
```

Run `npm run sample` and open `/presentation.html` for the independent example.

## Shared presentation and configuration panels

All editors support light and dark schemes. Put `data-uav3d-theme="light"` or
`data-uav3d-theme="dark"` on a wrapper around the editor, and update it when the
host application's theme changes. Nested editors inherit the palette. Without
a wrapper the editor retains its default dark appearance. The attribute also
sets the native control color scheme; selects and their options use explicit
foreground/background colors for Linux webviews.

The palette can be customized with `--uav3d-text-color`, `--uav3d-muted-color`,
`--uav3d-surface-background`, `--uav3d-input-background`,
`--uav3d-button-background`, `--uav3d-border-color`, and `--uav3d-accent-color`.
The presentation sample includes a live scheme selector.

`PresentationEditor` now renders **Model**, **VMTI**, and **Frustum** tabs. Model
opens first; the preview exists only while that tab is active. Frustum contains
independent **Footprint** and **Aircraft-to-ground lines** sections (initially
expanded). Reset frustum appearance changes only the current controlled draft.
Validation covers every tab, including hidden fields. The host must disable
Save when `presentationError(draft)` is nonempty.

`PresentationPanel` renders the selector above the editor and the Save, optional
Use source settings, and Close actions. Supply `choices: {key, label}[]`,
`selectedKey`, `onSelect`, `description`, loading/busy/error states, action
callbacks, and the editor as children. An application adapter around the editor
may load model catalogs, resolve URLs, and handle imports. Keep that adapter
inside the shared panel; do not copy the fields, tabs, selector or actions.

Presentation models accept optional `showVmtiTargets` and `frustum` fields.
`resolvePresentation` merges the frustum's `rays` and `groundOutline` fields at
each layer, preserving false and zero. Pass legacy scene values as the first
layer, then global presentation, source, and platform layers. Missing fields
inherit. Pass the resolved result to `Scene.configureModel(id, value)`; do not
also apply legacy visibility as a scene-wide gate. Existing scene-wide renderer
methods remain available for other consumers.

`SceneConfigEditor` owns Map content, token removal, advanced terrain/imagery,
asset selectors, folder-registration fields, and Save/Cancel. Supply a controlled
`SceneConfigDraft`, `onChange`, `assets: {id, name, kind}[]`, `busy`, `storageName`,
`onSave`, and `onCancel`. Optional `onRegisterFolder(kind, path)` returns a promise:
the host registers the folder and updates its assets and draft, while the editor
handles input and errors. Rejection keeps the path available for correction.
Use `sceneConfigError` for draft validation. The editor never contacts a backend.

The lower-level `MapEditor` and existing optional `mapConfig` props remain
supported. Applications with the complete settings UI should use
`SceneConfigEditor` to avoid duplicating those controls.

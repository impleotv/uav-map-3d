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
Global/source/item inheritance, Save/Cancel, and modal or panel layout belong
to the host.

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

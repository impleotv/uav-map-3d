# Map configuration

`configureMap` is asynchronous and each call replaces the previous configuration.
Keep the complete configuration in host state and await application. This example
uses the ellipsoid globe and disables ion content:

```ts
import type {MapConfig, Scene} from "@impleotv-pm/uav-map-3d";

export async function applyOfflineMap(scene: Scene) {
  const config: MapConfig = {offline: true};
  await scene.configureMap(config);
}
```

For local terrain or imagery, add host-resolved `terrainUrl` or `imageryUrl`.
Imagery options include `imageryScheme` (`xyz` or `tms`), `imageryProjection`
(`mercator` or `geographic`), `imageryMaxLevel`, and `imageryAttribution`.
Match these settings to the provider's actual tile layout.

For online content, pass `ion: {accessToken, worldTerrain, osmBuildings,
bingAerial, googlePhotorealistic}` with the desired booleans enabled. All flags
default to false. The token must grant the required assets/entitlements; use the
host's token input and avoid logging or embedding private credentials.

- Explicit terrain/imagery URLs take precedence over corresponding ion options.
- `offline: true` disables ion content, but does not make arbitrary explicit URLs
  local. The host must enforce local-only resources, including custom models.
- Tokens are passed per scene; the library does not persist them or change the
  global ion token. Route provider failures from `onError` into the host UI.
- Google Photorealistic 3D Tiles hides the visible globe and OSM buildings after
  loading. Disabling it restores the configured map. Initialization failure keeps
  the configured map visible.
- Sensor footprints/targets still use terrain or ellipsoid geometry. They do not
  intersect Google's mesh or building roofs, and overlays can be obscured by tiles.

Use offline mode for a provider-independent integration smoke test, then test the
user's intended providers with their own credentials. Keep Cesium/provider credits
visible and check network requests when validating an offline application.

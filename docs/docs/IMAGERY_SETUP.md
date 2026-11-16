# Satellite imagery and cadastral overlay (ISRO Bhuvan or any OGC WMS)

**Status (15 November 2026):** the existing connector is tested with a local stand-in server. The public Bhuvan API portal at
[`https://bhuvan-app1.nrsc.gov.in/api/`](https://bhuvan-app1.nrsc.gov.in/api/) responds, and describes proximity, thematic-statistics,
routing and geoid APIs. Its page says the access token expires in a day and is obtained through the logged-in portal. The public page
does **not** establish an authorized WMS/WMTS endpoint, available imagery layer names, supported CRS, or how its API token is accepted
by an OGC map service. `BHUVAN_API_TOKEN` was not present in the local environment when this check was performed. Therefore no
authenticated Bhuvan request or live imagery connection is claimed. The endpoint above is an API portal, not a verified WMS endpoint.
Imagery remains OFF by default; OSM continues to work.

## What the application does
The browser never talks to the imagery provider. The backend asks the provider for ONE WMS `GetMap` picture of the map area on the
browser's behalf (`GET /api/v1/gis/imagery/map`), so the provider URL and the key stay on the server, and every request needs a normal login
with the `GIS_READ` permission. Only PNG, JPEG, GIF and WebP answers up to the size limit are passed on; redirects are never followed.

## What to ask the provider for
1. The **WMS GetMap endpoint URL** (https) and the supported **WMS version** (1.1.1 or 1.3.0).
2. The **layer names** for satellite imagery, and for a cadastral/vector overlay if they offer one.
3. How requests are **authenticated**: none, a token/key in the URL, or a key in an HTTP header.
4. The **terms of use** and the exact **attribution text** you must display, plus any limits on how many requests you may make.

## Settings (environment variables of the backend)
| Variable | Meaning |
|---|---|
| `LANDNEXUS_IMAGERY_ENABLED` | `true` to switch it on (default `false`) |
| `LANDNEXUS_IMAGERY_URL` | the WMS endpoint, https |
| `LANDNEXUS_IMAGERY_LAYERS` | layer name(s) for the imagery, comma separated |
| `LANDNEXUS_IMAGERY_OVERLAY_URL`, `LANDNEXUS_IMAGERY_OVERLAY_LAYERS` | optional transparent overlay (for example cadastral lines); the URL is optional if it is the same service |
| `LANDNEXUS_IMAGERY_WMS_VERSION` | `1.1.1` (default) or `1.3.0` |
| `LANDNEXUS_IMAGERY_FORMAT` | `image/png` (default) or `image/jpeg` |
| `LANDNEXUS_IMAGERY_AUTH` | `NONE`, `QUERY_PARAM` or `HEADER` |
| `LANDNEXUS_IMAGERY_AUTH_NAME` | name of the query parameter or header (for example `token`) |
| `LANDNEXUS_IMAGERY_SECRET` | the key or token for the configured imagery service. **Never commit it or paste it in chat.** |
| `BHUVAN_API_TOKEN` | Optional secret source for a Bhuvan credential. It is not sent anywhere unless the imagery auth mode is explicitly configured. The token's transport for a WMS/WMTS service must first be confirmed with the service owner. |
| `LANDNEXUS_IMAGERY_ATTRIBUTION` | the text the provider requires you to show |
| `LANDNEXUS_IMAGERY_NAME` | display name (default `ISRO Bhuvan`) |

Set them in the same PowerShell window that starts the backend. A half-filled configuration stops the backend at start with a clear message.

## Check that it works
1. Obtain the authorized imagery service's WMS endpoint, permitted layer names, CRS, attribution and authentication method from Bhuvan/NRSC. The public API portal alone is not sufficient to configure WMS.
2. Set `LANDNEXUS_IMAGERY_URL`, `LANDNEXUS_IMAGERY_LAYERS`, the verified WMS version/auth mode and `LANDNEXUS_IMAGERY_ENABLED=true` in the backend process environment. Set `LANDNEXUS_IMAGERY_SECRET` (or `BHUVAN_API_TOKEN` only if the service confirms that credential applies).
3. Start the backend and log in as an administrator.
4. `POST /api/v1/gis/imagery/test` (the System settings page has a "Test connection" button). It asks the provider for a tiny picture and says
   whether a picture came back, how long it took and what went wrong. It never shows the URL or the key.
5. Open `/gis`: OSM is always the base map. The overlay appears only when a configured imagery request succeeds; provider authentication failures are identified separately from general unavailability.

## If it does not work
| Message | Likely cause |
|---|---|
| "did not return a picture (check the layer names and the credentials)" | wrong layer name, wrong WMS version, or missing/invalid key: the provider answered with an XML error |
| "HTTP 401/403" | key missing, expired, or sent in the wrong place (change `LANDNEXUS_IMAGERY_AUTH`) |
| "could not be reached" / "did not answer in time" | firewall, proxy, wrong URL, or the provider is down |
| picture appears shifted or flipped (WMS 1.3.0) | version 1.3.0 expects latitude first; the adapter handles it, but check the layer's CRS support |

## Limits
Only WMS GetMap in EPSG:4326 is supported (one picture per request, at most 1024 x 1024 pixels and 5 degrees per side).
There is no tile cache; the browser caches for 5 minutes. A 3D view is not provided.
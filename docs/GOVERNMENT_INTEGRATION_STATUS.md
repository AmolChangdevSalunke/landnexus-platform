# Government Integration Status

**Last updated:** 18 November 2026

**Rule:** an integration is only called **LIVE** when a tested, configured connection to the government system exists. Nothing in this repository meets that bar today.

| Integration | Current state | What exists in the repository | What is deliberately absent |
|---|---|---|---|
| BhuNaksha cadastral maps | **NOT IMPLEMENTED / SIMULATED BOUNDARY ONLY** | GIS screens accept officer-entered GeoJSON; parcel geometry is stored in PostGIS. | No cadastral service client, credentials, WMS/WMTS connection or map import. |
| Maharashtra 7/12 extract | **NOT IMPLEMENTED** | 7/12 records are entered and stored in the application. | No Mahabhulekh exchange, authentication or live fetch. |
| 8A record | **NOT IMPLEMENTED** | 8A records are entered and stored in the application. | No state-system exchange. |
| Ferfar mutation | **NOT IMPLEMENTED** | Mutations are recorded in the application. | No Ferfar service connection or reconciliation feed. |
| PFMS / DBT payment rail | **SIMULATED (LIMITED COMPENSATION FLOW)** | Existing compensation payments are explicitly simulated; outcomes can be simulated and confirmed payments have a protected text receipt. | No PFMS API, standalone DBT beneficiary/NPCI lifecycle, bank rail, real reconciliation or money movement. |
| OpenStreetMap | **LIVE PUBLIC BASEMAP** | Leaflet map uses OSM tiles as the interactive fallback, with attribution. | OSM is not an authoritative land-record or government boundary source; tile availability depends on network access and OSM usage policy. |
| ISRO Bhuvan imagery | **NOT VERIFIED / NOT CONNECTED** | Public Bhuvan API portal was reachable; optional imagery proxy reports connected only after a successful configured response; OSM remains active without it. | `BHUVAN_API_TOKEN` was unavailable in the local environment, so no authenticated request was made. No imagery endpoint/layer/CRS/licensing was verified. Do not display a connected claim without a successful live service check. |
| ISRO Bhuvan LULC AOI and village lookup | **IMPLEMENTED, NOT LIVE-VERIFIED** | Backend-only adapter at `/api/v1/gis/bhuvan/*`, reusing existing GIS permissions, geographic scope, audit, PostGIS corridor data and CSV writing. LULC AOI accepts a current project corridor or a WKT Polygon/MultiPolygon and stores every attempt in `bhuvan_lulc_analyses` (V27), with history and CSV/PDF export. Village geocoding/reverse geocoding are enabled for the documented AP/KA states; Maharashtra is refused by default until an operator records a real successful check. | `BHUVAN_API_TOKEN` was still unavailable, so no authenticated LULC or village success is recorded. The provider's unauthenticated/refused path was verified: an invalid token returns HTTP 200 with `{"error":"invalid_token"}` and is reported as a provider authentication failure, never as data. LULC Maharashtra coverage is not claimed until a live AOI run succeeds; village Maharashtra coverage is not documented by Bhuvan. Tokens are backend-only and never returned or logged. |
| Digital signatures | **NOT IMPLEMENTED** | Printable notices/awards only. | No DSC/eSign provider or signature verification. |
| E-mail / SMS delivery | **OPTIONAL, GENERIC** | Outbox, retries and `none` / `log` / `http` providers. Default is `none`. | No tested vendor integration; `http` is a generic webhook. |

## Safety and honesty requirements

1. Any future adapter must default to disabled and fail closed when configuration is missing.
2. A simulated response must carry an explicit `SIMULATED` marker in both the API payload and the UI.
3. Do not seed real personal, land or payment data for demos. All demo records are synthetic and labelled `DEMO`.
4. Integration secrets belong in environment variables, never in migrations, source or docs.
5. Record the actual tested scope in `docs/TESTING_AND_VERIFICATION.md`; do not describe an adapter as live because it compiles.

## GIS and simulated-payment boundary

The application has existing PostGIS parcel-boundary/project-alignment persistence and spatial conflict endpoints. The GIS map now submits supported parcel polygons and project alignments to those APIs; this is application GIS functionality, not a Bhuvan integration or an authoritative data feed. PFMS/DBT remains a limited simulated compensation-payment flow, not a standalone beneficiary/NPCI lifecycle.

## Planned Phase 3 approach

Phase 3 will add adapters behind explicit interfaces with timeouts, bounded retries, circuit-breaking or fail-closed behaviour, and contract tests using local fixtures. The default build and demo must continue to work with every external adapter disabled.

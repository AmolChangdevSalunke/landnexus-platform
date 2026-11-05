# LandNexus - Project Plan Additions

This file records plan-level concepts that are approved for a later phase but are **not**
part of the current delivery phase. They must not interrupt the agreed phase order.

## Section 8.14 - Permission-Based Geographic Map

**Status:** approved concept only. Not implemented in F2/F3. No GIS screen, map layer,
geometry API or map permission is being added in the current phase.

### Purpose

Give every user a map view of only the proposals, projects and land parcels that their
backend permissions and geographic scope allow them to see. The map is an additional way
to read the same authorised records; it must never become a way to discover records that
the list, details or API would hide.

### Core rule: the backend is the map authority

- The backend applies the caller's geographic scope (State, Division, District) and
  permissions **before** returning any feature.
- The frontend must not receive a full dataset and hide part of it in the browser.
- A feature returned by the API is treated as readable by the caller. A missing feature
  means "not permitted or outside scope", not "filtered by the UI".
- Map tile and bounding-box requests are authenticated and scoped exactly like normal
  record requests. A tile endpoint must not become an unauthenticated data leak.
- The map reuses the existing scope services and permission checks; it does not create a
  second, weaker authorisation path.

### Future data and API shape (concept)

- Geometry for proposal alignments and project corridors is stored with PostGIS
  (`geometry`/`geography` columns), not as browser-only drawing data.
- Land parcel boundaries and district/division/state boundaries become separate spatial
  layers with their own read permissions. Personal land-owner data is never shown on a
  shared map by default.
- A future map query accepts a bounding box, layer, status and project-type filters. The
  server intersects the bounding box with the caller's scope and returns only permitted
  features, with server pagination or vector-tile limits.
- Every feature carries the stable record id so a click can open the existing proposal or
  project details screen. The map does not duplicate workflow logic.
- Proposed permission codes (to be finalised with the security design) separate:
  - viewing the map at all;
  - reading proposals/projects on the map;
  - reading parcel boundaries;
  - reading aggregate village-level data.
- A read-only map is the default. Editing or drawing alignments is a separate permission
  and a separate phase.

### Privacy and audit

- Prefer village or district aggregation until parcel-level access is explicitly granted.
- Do not expose owner names, survey numbers or coordinates that identify private land in
  tooltips, URLs, logs or exported files without a dedicated permission.
- Record map access to sensitive layers in the audit trail, consistent with
  `AUDIT_READ` and the existing login/audit rules.
- Empty results must be shown honestly ("No permitted features in this area"), never
  filled with sample geometry.

### Intended user experience (later phase)

- A **Map** entry appears in navigation only when the user holds the map permission and a
  usable geographic scope.
- Filters for proposal status, project type, district/taluka and layer visibility.
- Clear legend, scale and "last updated" time; loading, empty, forbidden and network
  states that match the rest of the application.
- Clicking a feature opens the existing proposal/project details; workflow buttons still
  come only from `availableActions`.
- A visible scope summary ("Showing your districts") so users understand why some
  records are absent.
- Mobile layout remains usable; no map-only dead end when JavaScript or tiles fail.

### Delivery sequence when GIS is approved

1. Add geometry columns and import/validation rules for boundaries and alignments.
2. Extend `GeoScopeService` with a spatial filter and add scope/permission tests.
3. Add a scoped feature API (bounding box + layer + filters) and audit logging.
4. Add map permissions and seed them through a new Flyway migration.
5. Build the frontend map screen with the existing UI kit, `vardhan-maps` and MSW tests.
6. Add production tile hosting, caching, rate limits and monitoring.

### Explicit non-goals for F2/F3

- No map screen, map route, geometry editor or fake map data.
- No change to the proposal workflow or `availableActions`.
- No new GIS dependency or database migration in the current phase.
- No interruption of the frontend phase order; this section is a placeholder for a later
  approved GIS phase.

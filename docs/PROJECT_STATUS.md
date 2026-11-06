# LandNexus - Project Status

Last updated: 2026-11-06

## Environment (verified)
- Windows, Java 21, Maven Wrapper, Spring Boot 4.1.2, PostgreSQL 18.6 + PostGIS 3.6, database landnexus_dev
- Secrets only in environment variables: DB_PASSWORD, JWT_SECRET, LANDNEXUS_ADMIN_USERNAME/PASSWORD, LANDNEXUS_STORAGE_DIR

## Done and verified
- Module 1 Administration and Security: master data (7 resources), JWT login with refresh rotation, users, 13 roles, permissions,
  geographic scope, append-only audit trail, login history (Flyway V1-V4)
- Module 2 Government Projects: consultant proposals, reusable workflow engine, scrutiny, clarification, resubmission with versions,
  maker-checker approval, project creation, notifications (V5)
- Module 3 Land Records: parcels, landowners (masked and audited), ownership shares capped at 100%, mutations, 7/12 and 8A records,
  secure documents with validation, versions, manual verification, audited downloads (V6, V7)
- Verification: mvnw clean verify BUILD SUCCESS,  tests, 0 failures; end-to-end demo scripts PASS

## Not built yet
- Module 4 Land Acquisition, 5 Valuation and Compensation, 6 GIS, 7 Monitoring/MIS (SLA, escalation, dashboards, reports)
- React frontend (instruction prompt for OpenCode is ready; no frontend code against the real API yet)
- Password reset or change, IP rate limiting, virus scanning of uploads, Docker deployment

## Known risks and limits
- Access token stays valid up to 15 minutes after a user is disabled
- Uploaded files are not virus-scanned and not encrypted at rest (stored outside the project, random names)
- Landowner data is sensitive: only SYNTHETIC DEMO data may be used until retention and legal rules are defined
- Parcels are not yet linked to projects (comes with Module 4)
- show-sql is on (development); weak local DB password: change before any demo
- Nothing has been pushed to GitHub

## Next exact task
Frontend build with OpenCode (phase F0 plan approval), then Module 4 design.
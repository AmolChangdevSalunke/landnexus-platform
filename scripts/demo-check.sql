-- LandNexus demo database: read-only checks. Run: psql -U postgres -h localhost -d landnexus_demo -f scripts\demo-check.sql
SELECT 'states' AS what, COUNT(*) AS n FROM states UNION ALL SELECT 'districts', COUNT(*) FROM districts
UNION ALL SELECT 'talukas', COUNT(*) FROM talukas UNION ALL SELECT 'villages', COUNT(*) FROM villages
UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'proposals', COUNT(*) FROM proposals
UNION ALL SELECT 'projects', COUNT(*) FROM projects UNION ALL SELECT 'parcels', COUNT(*) FROM land_parcels
UNION ALL SELECT 'landowners', COUNT(*) FROM landowners UNION ALL SELECT 'ownerships', COUNT(*) FROM parcel_ownerships
UNION ALL SELECT 'boundaries (current)', COUNT(*) FROM parcel_boundaries WHERE superseded_at IS NULL
UNION ALL SELECT 'alignments (current)', COUNT(*) FROM project_alignments WHERE superseded_at IS NULL
UNION ALL SELECT 'acquisition cases', COUNT(*) FROM acquisition_cases UNION ALL SELECT 'case parcels', COUNT(*) FROM case_parcels
UNION ALL SELECT 'rates (approved)', COUNT(*) FROM market_value_rates WHERE status = 'APPROVED'
UNION ALL SELECT 'rates (pending)', COUNT(*) FROM market_value_rates WHERE status = 'PENDING'
UNION ALL SELECT 'rule sets (approved)', COUNT(*) FROM valuation_rule_sets WHERE status = 'APPROVED';

-- projects with their alignment and how many drawn parcel boundaries the corridor crosses
SELECT pr.code, pr.status, a.length_km, a.corridor_width_m,
       (SELECT COUNT(*) FROM parcel_boundaries b WHERE b.superseded_at IS NULL
          AND ST_Intersects(b.geom, ST_Buffer(a.geom::geography, (a.corridor_width_m / 2.0)::float8)::geometry)) AS parcels_crossed
FROM projects pr LEFT JOIN project_alignments a ON a.project_id = pr.id AND a.superseded_at IS NULL
ORDER BY pr.code;

-- parcels per village, how many have a boundary, and the total drawn area
SELECT v.name AS village, COUNT(p.id) AS parcels, COUNT(b.parcel_id) AS with_boundary, ROUND(COALESCE(SUM(b.area_ha), 0), 2) AS drawn_ha
FROM villages v JOIN land_parcels p ON p.village_id = v.id
LEFT JOIN parcel_boundaries b ON b.parcel_id = p.id AND b.superseded_at IS NULL
GROUP BY v.name ORDER BY v.name;

-- pairs of boundaries that overlap (the report should flag these)
SELECT p1.gat_number AS parcel_a, p2.gat_number AS parcel_b,
       ROUND((ST_Area(ST_CollectionExtract(ST_Intersection(b1.geom, b2.geom), 3)::geography) / 10000.0)::numeric, 4) AS overlap_ha
FROM parcel_boundaries b1 JOIN parcel_boundaries b2 ON b1.parcel_id < b2.parcel_id AND ST_Intersects(b1.geom, b2.geom)
JOIN land_parcels p1 ON p1.id = b1.parcel_id JOIN land_parcels p2 ON p2.id = b2.parcel_id
WHERE b1.superseded_at IS NULL AND b2.superseded_at IS NULL
  AND ST_Area(ST_CollectionExtract(ST_Intersection(b1.geom, b2.geom), 3)::geography) >= 1
ORDER BY overlap_ha DESC;

SELECT case_number, status FROM acquisition_cases ORDER BY case_number;
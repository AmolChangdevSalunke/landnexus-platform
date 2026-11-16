-- Add stable dimensions for MIS filters without changing existing report columns.
CREATE OR REPLACE VIEW rpt_projects AS
SELECT p.id,
       p.code AS project_code,
       p.title,
       p.project_type,
       p.status,
       p.state_id,
       s.name AS state_name,
       p.district_id,
       d.name AS district_name,
       p.estimated_land_area_ha,
       p.approved_at,
       p.id AS project_id,
       ARRAY(
           SELECT DISTINCT location.taluka_id
           FROM (
               SELECT v.taluka_id
               FROM project_villages pv JOIN villages v ON v.id = pv.village_id
               WHERE pv.project_id = p.id
               UNION
               SELECT p.taluka_id WHERE p.taluka_id IS NOT NULL
           ) location
       ) AS taluka_ids
FROM projects p
JOIN states s ON s.id = p.state_id
JOIN districts d ON d.id = p.district_id;

CREATE OR REPLACE VIEW rpt_cases AS
SELECT c.id,
       c.case_number,
       pj.code AS project_code,
       c.framework,
       c.status,
       c.state_id,
       c.district_id,
       d.name AS district_name,
       c.created_at,
       (SELECT COUNT(*) FROM case_parcels cp
         WHERE cp.case_id = c.id AND cp.released_at IS NULL) AS parcels,
       (SELECT COALESCE(SUM(cp.area_to_acquire_ha), 0) FROM case_parcels cp
         WHERE cp.case_id = c.id AND cp.released_at IS NULL) AS area_to_acquire_ha,
       (SELECT COUNT(DISTINCT fs.case_parcel_id) FROM field_surveys fs
         WHERE fs.case_id = c.id AND fs.status = 'VERIFIED') AS surveys_verified,
       (SELECT COUNT(*) FROM objections o
         WHERE o.case_id = c.id AND o.status = 'OPEN') AS open_objections,
       (SELECT COUNT(*) FROM possession_records pr
         WHERE pr.case_id = c.id) AS possessions,
       c.project_id,
       ARRAY(
           SELECT DISTINCT p.taluka_id
           FROM case_parcels cp
           JOIN land_parcels p ON p.id = cp.parcel_id
           WHERE cp.case_id = c.id
       ) AS taluka_ids
FROM acquisition_cases c
JOIN projects pj ON pj.id = c.project_id
JOIN districts d ON d.id = c.district_id;

CREATE OR REPLACE VIEW rpt_compensation AS
SELECT v.id,
       c.case_number,
       c.state_id,
       c.district_id,
       d.name AS district_name,
       COALESCE(p.gat_number, p.survey_number) AS parcel_label,
       v.version_no,
       v.status AS estimate_status,
       v.total_amount,
       (SELECT COALESCE(SUM(cpay.amount), 0) FROM compensation_payments cpay
         WHERE cpay.valuation_id = v.id AND cpay.status = 'CONFIRMED') AS confirmed_amount,
       c.project_id,
       v.created_at,
       ARRAY[p.taluka_id] AS taluka_ids
FROM valuations v
JOIN acquisition_cases c ON c.id = v.case_id
JOIN land_parcels p ON p.id = v.parcel_id
JOIN districts d ON d.id = c.district_id
WHERE v.status IN ('DRAFT', 'SUBMITTED', 'APPROVED');

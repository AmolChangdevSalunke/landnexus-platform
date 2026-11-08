-- V13: Module 7 (part 1) - the reporting read-model. The reporting module reads other modules' data ONLY through
-- these views (and its own read-only aggregate queries). No personal data: no names, addresses or phones of people.
-- If a column used here is ever renamed, the migration that renames it must update the view too.
CREATE VIEW rpt_projects AS
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
       p.approved_at
FROM projects p
JOIN states s ON s.id = p.state_id
JOIN districts d ON d.id = p.district_id;

CREATE VIEW rpt_cases AS
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
         WHERE pr.case_id = c.id) AS possessions
FROM acquisition_cases c
JOIN projects pj ON pj.id = c.project_id
JOIN districts d ON d.id = c.district_id;

CREATE VIEW rpt_compensation AS
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
         WHERE cpay.valuation_id = v.id AND cpay.status = 'CONFIRMED') AS confirmed_amount
FROM valuations v
JOIN acquisition_cases c ON c.id = v.case_id
JOIN land_parcels p ON p.id = v.parcel_id
JOIN districts d ON d.id = c.district_id
WHERE v.status IN ('DRAFT', 'SUBMITTED', 'APPROVED');

INSERT INTO permissions (code, description) VALUES
    ('DASHBOARD_READ', 'View dashboards (counts and totals only) within the geographic scope'),
    ('REPORT_READ',    'Run MIS reports within the geographic scope'),
    ('REPORT_EXPORT',  'Export MIS reports as CSV (every export is audited)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('DASHBOARD_READ', 'REPORT_READ')
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'REPORT_EXPORT'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'AUDITOR', 'FINANCE_OFFICER', 'COMPETENT_AUTHORITY');
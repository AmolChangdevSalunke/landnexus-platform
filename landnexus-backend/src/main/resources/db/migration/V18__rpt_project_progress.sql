-- V18: the NLAMS progress read-model used by the real-time dashboard. One row per project with the
-- counts and totals that the monitoring module is allowed to read across modules. No personal data:
-- families are counted as distinct landowner ids, never names or addresses.
-- "Acquired" means a possession record exists. Parcels of a CLOSED case are released from the case,
-- so they are counted on purpose; parcels of a CANCELLED case are not.
CREATE VIEW rpt_project_progress AS
SELECT pj.id AS project_id, pj.code AS project_code, pj.title, pj.project_type, pj.status AS project_status,
       pj.state_id, s.name AS state_name, pj.district_id, d.name AS district_name, pj.estimated_land_area_ha, pj.approved_at,
       COALESCE(al.length_km, 0) AS alignment_length_km,
       COALESCE(cs.cases, 0) AS cases, COALESCE(cs.open_cases, 0) AS open_cases,
       COALESCE(cs.cases_awaiting_notification, 0) AS cases_awaiting_notification, COALESCE(cs.cases_notified, 0) AS cases_notified,
       COALESCE(cs.cases_awaiting_award, 0) AS cases_awaiting_award, COALESCE(cs.cases_possession_complete, 0) AS cases_possession_complete,
       COALESCE(pa.parcels_identified, 0) AS parcels_identified, COALESCE(pa.identified_ha, 0) AS identified_ha,
       COALESCE(pa.parcels_notified, 0) AS parcels_notified, COALESCE(pa.notified_ha, 0) AS notified_ha,
       COALESCE(awa.awards, 0) AS awards, COALESCE(awa.parcels_awarded, 0) AS parcels_awarded, COALESCE(awa.awarded_ha, 0) AS awarded_ha,
       COALESCE(po.parcels_possessed, 0) AS parcels_possessed, COALESCE(po.possession_ha, 0) AS possession_ha,
       COALESCE(po.possession_physical, 0) AS possession_physical, COALESCE(po.possession_deemed, 0) AS possession_deemed,
       COALESCE(nt.notices, 0) AS notices, COALESCE(ob.objections, 0) AS objections, COALESCE(ob.objections_open, 0) AS objections_open,
       COALESCE(va.assessed_total, 0) AS assessed_total, COALESCE(va.awaiting_approval_total, 0) AS awaiting_approval_total,
       COALESCE(pm.paid_total, 0) AS paid_total, COALESCE(pm.sent_total, 0) AS sent_total, COALESCE(pm.failed_total, 0) AS failed_total,
       COALESCE(pm.instructed_total, 0) AS instructed_total, COALESCE(fa.affected_families, 0) AS affected_families,
       COALESCE(dr.displaced_families, 0) AS displaced_families, COALESCE(dr.livelihood_lost_families, 0) AS livelihood_lost_families,
       COALESCE(dr.rr_cases, 0) AS rr_cases, COALESCE(dr.rr_completed, 0) AS rr_completed,
       COALESCE(re.rr_entitlements, 0) AS rr_entitlements, COALESCE(re.rr_delivered, 0) AS rr_delivered
FROM projects pj
JOIN states s ON s.id = pj.state_id
JOIN districts d ON d.id = pj.district_id
LEFT JOIN project_alignments al ON al.project_id = pj.id AND al.superseded_at IS NULL
LEFT JOIN (SELECT project_id, COUNT(*) FILTER (WHERE status <> 'CANCELLED') AS cases,
                  COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'CLOSED')) AS open_cases,
                  COUNT(*) FILTER (WHERE status = 'VERIFICATION_COMPLETE') AS cases_awaiting_notification,
                  COUNT(*) FILTER (WHERE status IN ('NOTIFICATION_ISSUED', 'READY_FOR_AWARD', 'AWARD_DECLARED', 'POSSESSION_TAKEN', 'CLOSED')) AS cases_notified,
                  COUNT(*) FILTER (WHERE status = 'READY_FOR_AWARD') AS cases_awaiting_award,
                  COUNT(*) FILTER (WHERE status IN ('POSSESSION_TAKEN', 'CLOSED')) AS cases_possession_complete
           FROM acquisition_cases GROUP BY project_id) cs ON cs.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(*) AS parcels_identified, COALESCE(SUM(cp.area_to_acquire_ha), 0) AS identified_ha,
                  COUNT(*) FILTER (WHERE c.status IN ('NOTIFICATION_ISSUED', 'READY_FOR_AWARD', 'AWARD_DECLARED', 'POSSESSION_TAKEN', 'CLOSED')) AS parcels_notified,
                  COALESCE(SUM(cp.area_to_acquire_ha) FILTER (WHERE c.status IN ('NOTIFICATION_ISSUED', 'READY_FOR_AWARD', 'AWARD_DECLARED', 'POSSESSION_TAKEN', 'CLOSED')), 0) AS notified_ha
           FROM case_parcels cp JOIN acquisition_cases c ON c.id = cp.case_id
           WHERE c.status <> 'CANCELLED' AND (cp.released_at IS NULL OR c.status = 'CLOSED') GROUP BY c.project_id) pa ON pa.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(DISTINCT a.id) AS awards, COUNT(ap.id) AS parcels_awarded, COALESCE(SUM(ap.awarded_area_ha), 0) AS awarded_ha
           FROM acquisition_awards a JOIN acquisition_cases c ON c.id = a.case_id LEFT JOIN award_parcels ap ON ap.award_id = a.id
           GROUP BY c.project_id) awa ON awa.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(*) AS parcels_possessed, COALESCE(SUM(cp.area_to_acquire_ha), 0) AS possession_ha,
                  COUNT(*) FILTER (WHERE r.possession_type = 'PHYSICAL') AS possession_physical,
                  COUNT(*) FILTER (WHERE r.possession_type = 'DEEMED') AS possession_deemed
           FROM possession_records r JOIN case_parcels cp ON cp.id = r.case_parcel_id JOIN acquisition_cases c ON c.id = r.case_id
           GROUP BY c.project_id) po ON po.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(*) AS notices FROM legal_notices n JOIN acquisition_cases c ON c.id = n.case_id GROUP BY c.project_id) nt ON nt.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(*) AS objections, COUNT(*) FILTER (WHERE o.status = 'OPEN') AS objections_open
           FROM objections o JOIN acquisition_cases c ON c.id = o.case_id GROUP BY c.project_id) ob ON ob.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COALESCE(SUM(v.total_amount) FILTER (WHERE v.status = 'APPROVED'), 0) AS assessed_total,
                  COALESCE(SUM(v.total_amount) FILTER (WHERE v.status = 'SUBMITTED'), 0) AS awaiting_approval_total
           FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id WHERE v.status <> 'SUPERSEDED' GROUP BY c.project_id) va ON va.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'CONFIRMED'), 0) AS paid_total,
                  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'SENT'), 0) AS sent_total,
                  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'FAILED'), 0) AS failed_total,
                  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'INSTRUCTED'), 0) AS instructed_total
           FROM compensation_payments p JOIN acquisition_cases c ON c.id = p.case_id GROUP BY c.project_id) pm ON pm.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(DISTINCT cpo.landowner_id) AS affected_families
           FROM case_parcel_owners cpo JOIN case_parcels cp ON cp.id = cpo.case_parcel_id JOIN acquisition_cases c ON c.id = cp.case_id
           WHERE c.status <> 'CANCELLED' GROUP BY c.project_id) fa ON fa.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(DISTINCT r.landowner_id) FILTER (WHERE r.displaced) AS displaced_families,
                  COUNT(DISTINCT r.landowner_id) FILTER (WHERE r.livelihood_lost) AS livelihood_lost_families,
                  COUNT(*) AS rr_cases, COUNT(*) FILTER (WHERE r.status = 'COMPLETED') AS rr_completed
           FROM rr_cases r JOIN acquisition_cases c ON c.id = r.case_id GROUP BY c.project_id) dr ON dr.project_id = pj.id
LEFT JOIN (SELECT c.project_id, COUNT(*) AS rr_entitlements, COUNT(*) FILTER (WHERE e.status = 'DELIVERED') AS rr_delivered
           FROM rr_entitlements e JOIN rr_cases r ON r.id = e.rr_case_id JOIN acquisition_cases c ON c.id = r.case_id GROUP BY c.project_id) re ON re.project_id = pj.id;

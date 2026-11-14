-- =============================================================================
-- LandNexus: reconcile duplicate acquisition cases before Flyway V16
-- =============================================================================
-- Context
--   V16 adds UNIQUE (acquisition_cases.project_id).  The development database
--   has 11 projects with more than one acquisition case: one CLOSED canonical
--   case carrying the business data, plus one or two redundant INITIATED cases
--   created by repeated approvals / demo seeding.
--
-- What this script does (single transaction)
--   1. Validates every precondition.  Any unexpected value RAISEs and aborts.
--   2. Re-points the single CREATE history row of each redundant case to the
--      canonical case.  The history ID, actor_user_id, actor_username, action,
--      from_status, to_status, reason and occurred_at are NOT changed.
--   3. Deletes the redundant case_villages rows.  Each one is already present
--      on the canonical case (validated), so no association is lost.
--   4. Appends one audit_events row per merge, recording the full mapping and
--      the original history payload.
--   5. Deletes only the 15 redundant INITIATED cases.  No CASCADE is used.
--   6. Re-verifies history totals, original rows, canonical rows and uniqueness.
--
-- Audit-model note
--   acquisition_case_history is guarded by trg_case_history_append_only, which
--   forbids UPDATE and DELETE.  A merge has to change case_id on rows whose
--   audit payload must survive.  The trigger is therefore disabled for the
--   single UPDATE statement only, inside this transaction, and immediately
--   re-enabled.  The V4 migration itself documents this as a superuser-level
--   repair path ("tamper-resistant, not tamper-proof").  The append-only
--   audit_events table records the merge afterwards.  No audit content other
--   than the case_id foreign key is modified.
--
-- Usage
--   Dry run (default, always rolls back):
--     psql -U postgres -d landnexus_dev -f reconcile_duplicate_acquisition_cases.sql
--   Apply:
--     psql -U postgres -d landnexus_dev -v dry_run=0 -f reconcile_duplicate_acquisition_cases.sql
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?dry_run}
\else
  \set dry_run 1
\endif

BEGIN;

-- Serialise against any concurrent case creation for the duration.
LOCK TABLE acquisition_cases, acquisition_case_history, case_villages
  IN EXCLUSIVE MODE;

-- -----------------------------------------------------------------------------
-- Expected mapping (project -> retained CLOSED case).  Duplicates are derived
-- and validated below; they are never guessed.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE recon_map (
    project_id          uuid NOT NULL,
    canonical_case_id   uuid NOT NULL,
    duplicate_case_id   uuid NOT NULL,
    PRIMARY KEY (duplicate_case_id)
) ON COMMIT DROP;

INSERT INTO recon_map (project_id, canonical_case_id, duplicate_case_id)
SELECT m.project_id, m.canonical_case_id, c.id
FROM (VALUES
    ('0f74e90d-1fbe-4e6d-94cf-5be04357f2c9'::uuid, 'b3780dd9-8318-4f29-9005-6f21ac07b438'::uuid),
    ('1cd98c44-0fc6-470b-ac4a-5d40e5d6720c'::uuid, 'f3bca25c-fea3-49a5-aea7-901056d87602'::uuid),
    ('214fcd4f-3cb5-4180-ad16-5f5dfa415276'::uuid, '364b1429-97f9-488e-982d-963fb76a720c'::uuid),
    ('324d5d85-cf88-425e-8248-531a634e08f7'::uuid, 'e5bacd86-bc05-4306-8e63-95f5563a816d'::uuid),
    ('4930cd0d-98dc-4fab-b722-0cca8225462e'::uuid, 'b93ed320-c99c-4544-be08-a95eb4706906'::uuid),
    ('7a4938c4-cc9b-4ab1-bbd2-1585e983a1f1'::uuid, '0a0f0a3c-dd69-4cb6-b872-e97eeb678d35'::uuid),
    ('8b69c661-854c-4823-8014-7e78d8c47bec'::uuid, 'd1029674-c8db-4cd5-8f12-59e01f709c98'::uuid),
    ('93793c17-537d-4a88-835c-ef3b695a08c5'::uuid, '3de9abd0-e61a-40cb-8661-a81c49eb62a9'::uuid),
    ('9f343d26-38f6-4e4c-8f3b-8ed579060644'::uuid, 'cdcd37eb-afee-4eca-b6ab-a49b2a1ad5a3'::uuid),
    ('d17ef492-b6c8-4a58-97cd-45d5bead1fc4'::uuid, '2db5ad06-ba74-4d8b-b10f-83a8b26092c0'::uuid),
    ('e56bbb06-1a28-4866-b35b-381d213bd34e'::uuid, 'dc9094b2-0bb2-448b-a03e-5d2d28fa94f5'::uuid)
) AS m(project_id, canonical_case_id)
JOIN acquisition_cases c
  ON c.project_id = m.project_id
 AND c.id <> m.canonical_case_id
 AND c.status = 'INITIATED';

-- Snapshot the exact rows we are about to move or must leave untouched.
CREATE TEMP TABLE recon_dup_history_before ON COMMIT DROP AS
SELECT h.*
FROM acquisition_case_history h
JOIN recon_map m ON m.duplicate_case_id = h.case_id;

CREATE TEMP TABLE recon_canon_history_before ON COMMIT DROP AS
SELECT h.*
FROM acquisition_case_history h
JOIN (SELECT DISTINCT canonical_case_id FROM recon_map) m ON m.canonical_case_id = h.case_id;

CREATE TEMP TABLE recon_counts_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM acquisition_cases)                                   AS total_cases,
  (SELECT count(*) FROM acquisition_cases WHERE status = 'CLOSED')           AS total_closed,
  (SELECT count(*) FROM acquisition_cases WHERE status = 'INITIATED')        AS total_initiated,
  (SELECT count(*) FROM acquisition_case_history)                            AS total_history,
  (SELECT count(*) FROM case_villages)                                       AS total_case_villages;

-- -----------------------------------------------------------------------------
-- Precondition validation.  Every check raises on the first unexpected state.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v int;
  v_msg text;
BEGIN
  -- 1. Mapping must have exactly 11 distinct projects / canonical cases and
  --    exactly 15 derived duplicate cases.
  IF (SELECT count(*) FROM recon_map) <> 15 THEN
    RAISE EXCEPTION 'expected 15 redundant cases in recon_map, found %',
      (SELECT count(*) FROM recon_map);
  END IF;
  IF (SELECT count(DISTINCT project_id) FROM recon_map) <> 11 THEN
    RAISE EXCEPTION 'expected 11 distinct projects in recon_map';
  END IF;
  IF (SELECT count(DISTINCT canonical_case_id) FROM recon_map) <> 11 THEN
    RAISE EXCEPTION 'expected 11 distinct canonical cases in recon_map';
  END IF;
  IF (SELECT count(*) FROM (VALUES
        ('0f74e90d-1fbe-4e6d-94cf-5be04357f2c9'::uuid, 'b3780dd9-8318-4f29-9005-6f21ac07b438'::uuid),
        ('1cd98c44-0fc6-470b-ac4a-5d40e5d6720c'::uuid, 'f3bca25c-fea3-49a5-aea7-901056d87602'::uuid),
        ('214fcd4f-3cb5-4180-ad16-5f5dfa415276'::uuid, '364b1429-97f9-488e-982d-963fb76a720c'::uuid),
        ('324d5d85-cf88-425e-8248-531a634e08f7'::uuid, 'e5bacd86-bc05-4306-8e63-95f5563a816d'::uuid),
        ('4930cd0d-98dc-4fab-b722-0cca8225462e'::uuid, 'b93ed320-c99c-4544-be08-a95eb4706906'::uuid),
        ('7a4938c4-cc9b-4ab1-bbd2-1585e983a1f1'::uuid, '0a0f0a3c-dd69-4cb6-b872-e97eeb678d35'::uuid),
        ('8b69c661-854c-4823-8014-7e78d8c47bec'::uuid, 'd1029674-c8db-4cd5-8f12-59e01f709c98'::uuid),
        ('93793c17-537d-4a88-835c-ef3b695a08c5'::uuid, '3de9abd0-e61a-40cb-8661-a81c49eb62a9'::uuid),
        ('9f343d26-38f6-4e4c-8f3b-8ed579060644'::uuid, 'cdcd37eb-afee-4eca-b6ab-a49b2a1ad5a3'::uuid),
        ('d17ef492-b6c8-4a58-97cd-45d5bead1fc4'::uuid, '2db5ad06-ba74-4d8b-b10f-83a8b26092c0'::uuid),
        ('e56bbb06-1a28-4866-b35b-381d213bd34e'::uuid, 'dc9094b2-0bb2-448b-a03e-5d2d28fa94f5'::uuid)
      ) AS p(project_id, canonical_case_id)
      FULL JOIN (SELECT DISTINCT project_id, canonical_case_id FROM recon_map) m
        USING (project_id, canonical_case_id)
      WHERE p.project_id IS NULL OR m.project_id IS NULL) <> 0 THEN
    RAISE EXCEPTION 'derived mapping does not match the approved project -> canonical case mapping';
  END IF;

  -- 2. Global shape: 26 cases in the 11 groups, 11 CLOSED + 15 INITIATED.
  SELECT count(*) INTO v FROM acquisition_cases;
  IF v <> 28 THEN RAISE EXCEPTION 'expected 28 acquisition cases in total, found %', v; END IF;
  SELECT count(*) INTO v FROM acquisition_cases c
   WHERE c.project_id IN (SELECT project_id FROM recon_map);
  IF v <> 26 THEN RAISE EXCEPTION 'expected 26 cases in the 11 duplicate groups, found %', v; END IF;
  SELECT count(*) INTO v FROM acquisition_cases c
   WHERE c.project_id IN (SELECT project_id FROM recon_map) AND c.status = 'CLOSED';
  IF v <> 11 THEN RAISE EXCEPTION 'expected 11 CLOSED cases in the groups, found %', v; END IF;
  SELECT count(*) INTO v FROM acquisition_cases c
   WHERE c.project_id IN (SELECT project_id FROM recon_map) AND c.status = 'INITIATED';
  IF v <> 15 THEN RAISE EXCEPTION 'expected 15 INITIATED cases in the groups, found %', v; END IF;

  -- 3. Exactly 11 projects currently have >1 case, and they are the mapped ones.
  SELECT count(*) INTO v FROM (
    SELECT project_id FROM acquisition_cases GROUP BY project_id HAVING count(*) > 1
  ) d;
  IF v <> 11 THEN RAISE EXCEPTION 'expected 11 duplicate project groups, found %', v; END IF;
  SELECT count(*) INTO v FROM (
    SELECT project_id FROM acquisition_cases GROUP BY project_id HAVING count(*) > 1
  ) d
  LEFT JOIN recon_map m ON m.project_id = d.project_id
  WHERE m.project_id IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION '% duplicate group(s) are not covered by the mapping', v; END IF;

  -- 4. Canonical and duplicate cases exist, belong to the project, and have
  --    the expected statuses.  No canonical case is also a duplicate.
  SELECT count(*) INTO v
  FROM recon_map m
  LEFT JOIN acquisition_cases k ON k.id = m.canonical_case_id
  LEFT JOIN acquisition_cases d ON d.id = m.duplicate_case_id
  WHERE k.id IS NULL
     OR d.id IS NULL
     OR k.project_id <> m.project_id
     OR d.project_id <> m.project_id
     OR k.status <> 'CLOSED'
     OR d.status <> 'INITIATED';
  IF v <> 0 THEN RAISE EXCEPTION 'mapping/status validation failed for % row(s)', v; END IF;
  SELECT count(*) INTO v FROM recon_map m
  JOIN recon_map d ON d.duplicate_case_id = m.canonical_case_id;
  IF v <> 0 THEN RAISE EXCEPTION 'a canonical case is also listed as a duplicate'; END IF;

  -- 5. Every duplicate has exactly one history row: CREATE / INITIATED, no
  --    from_status, with an actor and timestamp.  Canonical rows are separate.
  SELECT count(*) INTO v FROM recon_map m
  WHERE (SELECT count(*) FROM acquisition_case_history h WHERE h.case_id = m.duplicate_case_id) <> 1;
  IF v <> 0 THEN RAISE EXCEPTION '% duplicate case(s) do not have exactly one history row', v; END IF;
  SELECT count(*) INTO v
  FROM acquisition_case_history h
  JOIN recon_map m ON m.duplicate_case_id = h.case_id
  WHERE h.action <> 'CREATE'
     OR h.to_status <> 'INITIATED'
     OR h.from_status IS NOT NULL
     OR h.actor_username IS NULL
     OR h.occurred_at IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION '% duplicate history row(s) are not CREATE/INITIATED', v; END IF;
  IF (SELECT count(*) FROM recon_dup_history_before) <> 15 THEN
    RAISE EXCEPTION 'expected 15 duplicate history rows, found %',
      (SELECT count(*) FROM recon_dup_history_before);
  END IF;
  IF (SELECT count(DISTINCT id) FROM recon_dup_history_before) <> 15 THEN
    RAISE EXCEPTION 'duplicate history IDs are not distinct';
  END IF;

  -- 6. No business records in the other ten direct child tables.
  SELECT count(*) INTO v FROM case_parcels          WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % case_parcels row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM field_surveys         WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % field_surveys row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM legal_notices         WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % legal_notices row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM objections            WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % objections row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM acquisition_awards    WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % acquisition_awards row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM possession_records    WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % possession_records row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM valuations            WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % valuations row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM compensation_payments WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % compensation_payments row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM rr_cases              WHERE case_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % rr_cases row(s) on redundant cases', v; END IF;

  -- 7. case_villages rows on duplicates must be a subset of the canonical
  --    case's villages (the PK is (case_id, village_id), so deleting them
  --    loses nothing).  Any genuinely new association aborts the merge.
  SELECT count(*) INTO v
  FROM case_villages cv
  JOIN recon_map m ON m.duplicate_case_id = cv.case_id
  WHERE NOT EXISTS (
    SELECT 1 FROM case_villages ck
    WHERE ck.case_id = m.canonical_case_id AND ck.village_id = cv.village_id
  );
  IF v <> 0 THEN RAISE EXCEPTION '% village association(s) exist only on redundant cases', v; END IF;

  -- 8. No notification / SLA rows point at the redundant cases.
  SELECT count(*) INTO v FROM notifications n WHERE n.entity_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % notifications row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM rpt_sla_items s WHERE s.entity_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % rpt_sla_items row(s) on redundant cases', v; END IF;
  SELECT count(*) INTO v FROM sla_escalations e WHERE e.entity_id IN (SELECT duplicate_case_id FROM recon_map);
  IF v <> 0 THEN RAISE EXCEPTION 'found % sla_escalations row(s) on redundant cases', v; END IF;

  -- 9. The append-only trigger must exist and be enabled before we touch it.
  SELECT count(*) INTO v
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'acquisition_case_history'
    AND t.tgname = 'trg_case_history_append_only'
    AND t.tgenabled = 'O';
  IF v <> 1 THEN RAISE EXCEPTION 'append-only history trigger is missing or already disabled'; END IF;
END $$;

\echo 'Preconditions OK.  Rows to reconcile:'

SELECT m.project_id,
       k.case_number AS canonical_case,
       d.case_number AS duplicate_case,
       h.id          AS history_id,
       h.action,
       h.actor_username,
       h.occurred_at
FROM recon_map m
JOIN acquisition_cases k ON k.id = m.canonical_case_id
JOIN acquisition_cases d ON d.id = m.duplicate_case_id
JOIN acquisition_case_history h ON h.case_id = m.duplicate_case_id
ORDER BY m.project_id, d.case_number;

-- -----------------------------------------------------------------------------
-- Reconciliation
-- -----------------------------------------------------------------------------

-- Move ONLY the case_id.  Audit content (id, actor, action, reason, time) is
-- untouched.  The append-only guard is suspended for this statement only.
ALTER TABLE acquisition_case_history DISABLE TRIGGER trg_case_history_append_only;

UPDATE acquisition_case_history h
SET case_id = m.canonical_case_id
FROM recon_map m
WHERE h.case_id = m.duplicate_case_id;

ALTER TABLE acquisition_case_history ENABLE TRIGGER trg_case_history_append_only;

-- Remove redundant village links (validated subset of the canonical links).
DELETE FROM case_villages cv
USING recon_map m
WHERE cv.case_id = m.duplicate_case_id;

-- Append a durable audit record of each merge, including the original history
-- payload so the repair is reconstructable.
INSERT INTO audit_events (occurred_at, actor_user_id, actor_username, action, entity_type, entity_id, details)
SELECT now(),
       NULL,
       'system-reconciliation',
       'MERGE_DUPLICATE',
       'AcquisitionCase',
       m.canonical_case_id,
       jsonb_build_object(
         'projectId',          m.project_id,
         'canonicalCaseId',    m.canonical_case_id,
         'duplicateCaseId',    m.duplicate_case_id,
         'duplicateCaseNumber', d.case_number,
         'historyId',          b.id,
         'historyAction',      b.action,
         'historyFromStatus',  b.from_status,
         'historyToStatus',    b.to_status,
         'historyActorUserId', b.actor_user_id,
         'historyActor',       b.actor_username,
         'historyReason',      b.reason,
         'historyOccurredAt',  b.occurred_at,
         'reason',             'Flyway V16 duplicate acquisition case reconciliation'
       )::text
FROM recon_map m
JOIN acquisition_cases d ON d.id = m.duplicate_case_id
JOIN recon_dup_history_before b ON b.case_id = m.duplicate_case_id;

-- Delete only the redundant cases.  No CASCADE: if any dependent row remains,
-- this statement fails and the whole transaction rolls back.
DO $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM acquisition_cases
  WHERE id IN (SELECT duplicate_case_id FROM recon_map);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 15 THEN
    RAISE EXCEPTION 'expected to delete 15 redundant cases, deleted %', v_deleted;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Postcondition validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v int;
BEGIN
  -- Zero duplicate project IDs remain.
  SELECT count(*) INTO v FROM (
    SELECT project_id FROM acquisition_cases GROUP BY project_id HAVING count(*) > 1
  ) d;
  IF v <> 0 THEN RAISE EXCEPTION '% duplicate project group(s) remain', v; END IF;

  -- Total case counts: 28 - 15 = 13; the 11 mapped projects keep 11 cases.
  SELECT count(*) INTO v FROM acquisition_cases;
  IF v <> 13 THEN RAISE EXCEPTION 'expected 13 cases after reconciliation, found %', v; END IF;
  SELECT count(*) INTO v FROM acquisition_cases
   WHERE project_id IN (SELECT project_id FROM recon_map);
  IF v <> 11 THEN RAISE EXCEPTION 'expected 11 cases in the mapped projects after reconciliation, found %', v; END IF;

  -- History rows are neither lost nor added: still 105.
  SELECT count(*) INTO v FROM acquisition_case_history;
  IF v <> (SELECT total_history FROM recon_counts_before) THEN
    RAISE EXCEPTION 'history row count changed: before %, after %',
      (SELECT total_history FROM recon_counts_before), v;
  END IF;

  -- All 15 original duplicate history rows still exist, with identical audit
  -- content, now attached to their canonical case.
  SELECT count(*) INTO v
  FROM recon_dup_history_before b
  JOIN recon_map m ON m.duplicate_case_id = b.case_id
  LEFT JOIN acquisition_case_history h ON h.id = b.id
  WHERE h.id IS NULL
     OR h.case_id <> m.canonical_case_id
     OR h.action <> b.action
     OR h.to_status <> b.to_status
     OR h.from_status IS DISTINCT FROM b.from_status
     OR h.actor_user_id IS DISTINCT FROM b.actor_user_id
     OR h.actor_username <> b.actor_username
     OR h.reason IS DISTINCT FROM b.reason
     OR h.occurred_at <> b.occurred_at;
  IF v <> 0 THEN RAISE EXCEPTION '% transferred history row(s) differ or are missing', v; END IF;

  -- Every canonical row that existed before is untouched.
  SELECT count(*) INTO v
  FROM recon_canon_history_before b
  LEFT JOIN acquisition_case_history h ON h.id = b.id
  WHERE h.id IS NULL
     OR h.case_id <> b.case_id
     OR h.action <> b.action
     OR h.to_status <> b.to_status
     OR h.from_status IS DISTINCT FROM b.from_status
     OR h.actor_user_id IS DISTINCT FROM b.actor_user_id
     OR h.actor_username <> b.actor_username
     OR h.reason IS DISTINCT FROM b.reason
     OR h.occurred_at <> b.occurred_at;
  IF v <> 0 THEN RAISE EXCEPTION '% canonical history row(s) were altered or lost', v; END IF;

  -- Trigger is enabled again.
  SELECT count(*) INTO v
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'acquisition_case_history'
    AND t.tgname = 'trg_case_history_append_only'
    AND t.tgenabled = 'O';
  IF v <> 1 THEN RAISE EXCEPTION 'append-only history trigger was not re-enabled'; END IF;

  -- One merge audit row per removed case.
  SELECT count(*) INTO v
  FROM audit_events
  WHERE action = 'MERGE_DUPLICATE' AND entity_type = 'AcquisitionCase';
  IF v <> 15 THEN RAISE EXCEPTION 'expected 15 MERGE_DUPLICATE audit rows, found %', v; END IF;
END $$;

\echo 'Postconditions OK.  History per canonical case:'

SELECT k.case_number,
       count(h.id) AS history_rows,
       count(*) FILTER (WHERE h.action = 'CREATE') AS create_rows
FROM acquisition_cases k
JOIN (SELECT DISTINCT canonical_case_id FROM recon_map) m ON m.canonical_case_id = k.id
LEFT JOIN acquisition_case_history h ON h.case_id = k.id
GROUP BY k.id, k.case_number
ORDER BY k.case_number;

\if :dry_run
\echo 'DRY RUN: all validations passed, rolling back (use -v dry_run=0 to apply).'
ROLLBACK;
\else
\echo 'Reconciliation applied and committed.'
COMMIT;
\endif

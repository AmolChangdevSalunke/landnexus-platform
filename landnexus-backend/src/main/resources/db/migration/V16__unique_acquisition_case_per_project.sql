-- V16: Proposal approval reliability - ensure exactly one acquisition case per project.
-- Fails fast (without data changes) if existing data would violate the constraint.

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT project_id
        FROM acquisition_cases
        GROUP BY project_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Cannot add unique constraint on acquisition_cases.project_id: % project(s) have duplicate acquisition cases. Resolve duplicates manually before retrying migration.', duplicate_count;
    END IF;
END $$;

ALTER TABLE acquisition_cases
    ADD CONSTRAINT uq_acquisition_cases_project UNIQUE (project_id);

-- Index for job cleanup on block close
-- Called on every terminal block close (frequent operation)
-- Performance: O(n) → O(log n) lookup
-- Query: SELECT oid FROM db_job WHERE json_extract(data, '$.attachedblockid') = ?

CREATE INDEX IF NOT EXISTS idx_job_attachedblockid
ON db_job(json_extract(data, '$.attachedblockid'))
WHERE json_extract(data, '$.attachedblockid') IS NOT NULL;

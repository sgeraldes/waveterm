-- Drop orphaned telemetry tables
-- These tables were created for telemetry feature removed in Jan 2026
-- Commits: e74e3754, c816c916, 237bcf20
-- No data migration needed - telemetry was completely removed

DROP TABLE IF EXISTS db_activity;
DROP TABLE IF EXISTS db_tevent;

-- Note: history_migrated is intentionally kept for legacy database migration
-- from pre-v0.9 WaveTerm databases located at ~/.waveterm/waveterm.db
-- This table is only used once during initial migration and never accessed again,
-- but must remain for users who haven't migrated yet.

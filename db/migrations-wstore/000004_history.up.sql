-- Note: history_migrated is a special migration-only table.
-- It is populated during TryMigrateOldHistory() when upgrading from pre-v0.9 WaveTerm.
-- After initial migration, this table is never accessed again, but must remain
-- for users who haven't migrated yet. Do not drop this table.

CREATE TABLE history_migrated (
	historyid varchar(36) PRIMARY KEY,
    ts bigint NOT NULL,
	remotename varchar(200) NOT NULL,
	haderror boolean NOT NULL,
    cmdstr text NOT NULL,
	exitcode int NULL DEFAULT NULL,
	durationms int NULL DEFAULT NULL
);

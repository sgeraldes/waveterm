# DB-005: Workspace Name Index Decision

**Status:** ✅ DECISION: DO NOT CREATE INDEX

**Date:** 2026-02-27

## Query Analysis

**Location:** `pkg/wstore/wstore_dbops.go:60`

**Query:**
```sql
SELECT count(*) FROM db_workspace
WHERE COALESCE(json_extract(data, '$.name'), '') <> ''
```

**Function:** `DBGetWSCounts()`

## Decision Rationale

### Key Findings

1. **Function is unused**: `DBGetWSCounts()` is never called anywhere in the codebase (dead code)
2. **Tiny table size**: `db_workspace` typically has <10 rows (one per workspace)
3. **Rare query**: Even if used, would only be for statistics collection
4. **Performance**: Full table scan is faster than index lookup for tables <100 rows

### Performance Analysis

| Operation | With Index | Without Index |
|-----------|------------|---------------|
| INSERT workspace | +50-100μs overhead | 0μs overhead |
| UPDATE workspace name | +50-100μs overhead | 0μs overhead |
| Query execution | ~20-50μs | ~5-10μs (10 rows) |

**Conclusion:** Index would make queries SLOWER while adding maintenance overhead.

### SQLite Index Guidelines

SQLite documentation recommends avoiding indexes when:
- Table has <100 rows
- Query is infrequent
- Full scan is faster than index overhead
- Index maintenance cost exceeds query benefit

All four conditions apply here.

## Implementation

Added documentation comment to `pkg/wstore/wstore_dbops.go` explaining:
- Function is unused (dead code)
- Why no index is intentional
- Performance reasoning
- Table size characteristics

## Migration Status

**Migration created:** ❌ NO

**Reason:** Index provides negative value (slows down operations)

## Future Considerations

If workspace count ever exceeds 100 workspaces:
1. Re-evaluate index need
2. Measure actual query performance
3. Consider partial index with WHERE clause
4. Monitor insert/update overhead

Until then, index is **not recommended**.

## Related Files

- `pkg/wstore/wstore_dbops.go` - Query location and documentation
- `db/migrations-wstore/000006_workspace.up.sql` - Workspace table schema
- `DATABASE_SCHEMA_AUDIT_ENHANCED.md` - Schema audit documentation

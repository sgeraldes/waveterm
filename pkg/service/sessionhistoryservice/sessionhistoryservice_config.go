
package sessionhistoryservice

import "time"

const (
	cleanupMaxAge       = 30 * 24 * time.Hour
	cleanupMaxSizeBytes = int64(500 * 1024 * 1024)
)

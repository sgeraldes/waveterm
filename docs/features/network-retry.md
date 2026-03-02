# Network Operation Retry Mechanisms

Wave Terminal includes automatic retry mechanisms for network operations to handle transient failures gracefully. This document describes how retry logic works and how to use it in your code.

## Overview

Network operations can fail for temporary reasons:
- Network timeouts
- Service rate limits (429)
- Service temporarily unavailable (503)
- Gateway timeouts (504)
- Connection resets

The retry system automatically handles these failures with exponential backoff, improving reliability without requiring manual intervention.

## Automatic Retry Coverage

The following operations automatically retry on transient failures:

### 1. WebSocket Connection
- Automatic reconnection with exponential backoff
- Up to 20 retry attempts
- Delay schedule: 0s, 0s, 2s, 5s, 10s, 10s, 30s, 60s
- No code changes needed - always active

### 2. SSH Connections
- Automatic retry on network errors
- Up to 2 retry attempts (fewer to avoid long hangs)
- Does NOT retry authentication failures
- Logs retry attempts to block logger

### 3. AI API Calls
- OpenAI and Anthropic backends
- Handles rate limits (429) automatically
- Up to 3 retry attempts
- Exponential backoff: 1s, 2s, 4s

### 4. RPC Calls
- All RPC operations (file read/write, remote operations)
- Enabled by default, can be disabled per-call
- Up to 3 retry attempts
- Configurable via `RpcOpts`

## Using Retry in Your Code

### TypeScript

#### Basic Usage

```typescript
import { retryWithBackoff } from "@/util/retryutil";

async function fetchData() {
    return await retryWithBackoff(async () => {
        const response = await fetch("https://api.example.com/data");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    });
}
```

#### Custom Configuration

```typescript
import { retryWithBackoff, RetryOptions } from "@/util/retryutil";

const options: RetryOptions = {
    maxRetries: 5,              // More attempts
    initialDelay: 500,          // Start with 500ms
    maxDelay: 30000,            // Cap at 30 seconds
    backoffMultiplier: 3,       // Triple delay each time
    shouldRetry: (error) => {
        // Custom retry logic
        return error.message.includes("timeout");
    },
    onRetry: (attempt, error, delay) => {
        console.log(`Retry ${attempt}: ${error.message} (waiting ${delay}ms)`);
    }
};

await retryWithBackoff(myFunction, options);
```

#### Marking Errors as Retryable/Non-Retryable

```typescript
import { RetryableError, NonRetryableError } from "@/util/retryutil";

async function myFunction() {
    try {
        // ... do work ...
    } catch (error) {
        if (isAuthError(error)) {
            // Don't retry auth failures
            throw new NonRetryableError("Authentication failed", error);
        }
        if (isNetworkError(error)) {
            // Always retry network errors
            throw new RetryableError("Network error", error);
        }
        throw error; // Use default retry logic
    }
}
```

#### RPC Calls with Custom Retry

```typescript
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

// Retry enabled by default
const result = await RpcApi.FileReadCommand(TabRpcClient, {
    path: "/path/to/file"
});

// Disable retry for specific call
const result2 = await RpcApi.FileReadCommand(TabRpcClient,
    { path: "/path/to/file" },
    { retry: false }
);

// Custom max retries
const result3 = await RpcApi.FileReadCommand(TabRpcClient,
    { path: "/path/to/file" },
    { maxRetries: 5 }
);
```

### Go

#### Basic Usage

```go
import (
    "context"
    "github.com/wavetermdev/waveterm/pkg/util/retryutil"
)

func fetchData(ctx context.Context) error {
    opts := retryutil.DefaultRetryOptions()

    return retryutil.RetryWithBackoff(ctx, func() error {
        // ... do work ...
        return nil
    }, opts)
}
```

#### With Return Value

```go
import "github.com/wavetermdev/waveterm/pkg/util/retryutil"

func fetchData(ctx context.Context) ([]byte, error) {
    opts := retryutil.DefaultRetryOptions()

    return retryutil.RetryWithBackoffValue(ctx, func() ([]byte, error) {
        // ... do work ...
        return data, nil
    }, opts)
}
```

#### Custom Configuration

```go
opts := retryutil.RetryOptions{
    MaxRetries:        5,
    InitialDelay:      500 * time.Millisecond,
    MaxDelay:          30 * time.Second,
    BackoffMultiplier: 3.0,
    ShouldRetry: func(err error) bool {
        // Custom retry logic
        return strings.Contains(err.Error(), "timeout")
    },
    OnRetry: func(attempt int, err error, delay time.Duration) {
        log.Printf("Retry %d: %v (waiting %.1fs)", attempt, err, delay.Seconds())
    },
}

err := retryutil.RetryWithBackoff(ctx, myFunc, opts)
```

#### Marking Errors

```go
import "github.com/wavetermdev/waveterm/pkg/util/retryutil"

func myFunction() error {
    // ... do work ...

    if isAuthError(err) {
        // Don't retry
        return &retryutil.NonRetryableError{Err: err}
    }

    if isNetworkError(err) {
        // Always retry
        return &retryutil.RetryableError{Err: err}
    }

    return err // Use default retry logic
}
```

## Retry Behavior

### Default Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Max Retries | 3 | Total attempts after initial failure |
| Initial Delay | 1s | Delay before first retry |
| Max Delay | 16s | Maximum delay between retries |
| Backoff Multiplier | 2x | Delay doubles each retry |

**Retry Schedule**: 1s, 2s, 4s, 8s, 16s

### Transient vs Permanent Errors

**Will Retry**:
- Network timeouts
- Connection refused/reset
- HTTP 429 (Rate Limit)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- HTTP 408 (Request Timeout)
- HTTP 5xx (Server Errors)
- Errors marked with `RetryableError`

**Will NOT Retry**:
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 404 (Not Found)
- HTTP 400 (Bad Request)
- Context cancelled
- Errors marked with `NonRetryableError`

### HTTP Status Code Handling

```typescript
import { isRetryableHttpStatus } from "@/util/retryutil";

if (isRetryableHttpStatus(response.status)) {
    // Will retry: 408, 429, 503, 504, 5xx
} else {
    // Won't retry: 2xx, 4xx (except 408, 429)
}
```

### Retry-After Header

The retry system can parse `Retry-After` headers (future enhancement):

```typescript
import { parseRetryAfter } from "@/util/retryutil";

const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
if (retryAfter !== null) {
    await new Promise(resolve => setTimeout(resolve, retryAfter));
}
```

## Best Practices

### 1. Use Default Settings First
```typescript
// Good - use defaults
await retryWithBackoff(myFunction);

// Only customize if needed
await retryWithBackoff(myFunction, { maxRetries: 5 });
```

### 2. Respect Context Cancellation (Go)
```go
// Good - pass context through
err := retryutil.RetryWithBackoff(ctx, func() error {
    return doWork(ctx)  // Use same context
}, opts)

// Bad - creates uninterruptible work
err := retryutil.RetryWithBackoff(ctx, func() error {
    return doWork(context.Background())  // Can't be cancelled
}, opts)
```

### 3. Mark Obvious Non-Retryable Errors
```typescript
if (error.status === 401) {
    throw new NonRetryableError("Auth failed");
}
```

### 4. Log Retry Attempts for Debugging
```typescript
await retryWithBackoff(myFunction, {
    onRetry: (attempt, error, delay) => {
        console.log(`Retry ${attempt}: ${error.message}`);
    }
});
```

### 5. Consider User Experience
```typescript
// Short max delay for user-facing operations
await retryWithBackoff(uiOperation, { maxDelay: 5000 });

// Longer max delay for background tasks
await retryWithBackoff(backgroundSync, { maxDelay: 60000 });
```

## Troubleshooting

### Operation Keeps Failing

Check the logs for retry attempts:
```
[OpenAI] Retrying API call (attempt 1/3) after error: rate limit exceeded (waiting 1.0s)
[OpenAI] Retrying API call (attempt 2/3) after error: rate limit exceeded (waiting 2.0s)
```

If you see all attempts exhausted, the error is likely permanent.

### Too Many Retries

Reduce max retries for operations that fail quickly:
```typescript
await retryWithBackoff(fastOperation, { maxRetries: 1 });
```

### Retries Take Too Long

Reduce delays:
```typescript
await retryWithBackoff(operation, {
    initialDelay: 500,
    maxDelay: 5000
});
```

### Operation Shouldn't Retry

Mark errors explicitly:
```typescript
throw new NonRetryableError("Invalid input");
```

Or disable retry:
```typescript
await RpcApi.SomeCommand(client, data, { retry: false });
```

## Examples

### Robust File Download

```typescript
import { retryWithBackoff } from "@/util/retryutil";

async function downloadFile(url: string): Promise<Blob> {
    return await retryWithBackoff(async () => {
        const response = await fetch(url);

        if (response.status === 404) {
            throw new NonRetryableError("File not found");
        }

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`) as any;
            error.response = { status: response.status };
            throw error;
        }

        return await response.blob();
    }, {
        onRetry: (attempt, error, delay) => {
            console.log(`Retrying download (${attempt}/3)...`);
        }
    });
}
```

### Resilient SSH Connection (Go)

```go
func connectWithRetry(ctx context.Context, host string) (*ssh.Client, error) {
    opts := retryutil.DefaultRetryOptions()
    opts.MaxRetries = 2  // Avoid long hangs
    opts.OnRetry = func(attempt int, err error, delay time.Duration) {
        log.Printf("[SSH] Retry %d: %v", attempt, err)
    }

    return retryutil.RetryWithBackoffValue(ctx, func() (*ssh.Client, error) {
        client, err := ssh.Dial("tcp", host, config)
        if err != nil {
            // Don't retry auth failures
            if strings.Contains(err.Error(), "unable to authenticate") {
                return nil, &retryutil.NonRetryableError{Err: err}
            }
        }
        return client, err
    }, opts)
}
```

## See Also

- [WebSocket Reconnection](./reconnection-feature.md)
- [Connection Status](./connection-status.md)
- [Error Handling](./error-handling.md)

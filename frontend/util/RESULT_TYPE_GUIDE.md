# Result Type Guide

## Overview

The Result type system provides **type-safe error handling** for Wave Terminal operations. It forces developers to explicitly handle errors at compile-time, preventing unhandled promise rejections and runtime crashes.

## Problem Solved

**Before (unsafe):**
```typescript
// No compile-time reminder to handle errors
const data = await RpcApi.ConnectCommand(client, { host: "example" });
// What if this throws? TypeScript doesn't tell us!
console.log(data); // Could crash here
```

**After (type-safe):**
```typescript
// TypeScript forces error handling
const result = await connectToRemote("example", blockId);
if (isErr(result)) {
    // MUST handle error before accessing data
    showErrorNotification("Connection Failed", result.error);
    return;
}
// TypeScript knows result.data is safe to access
console.log(result.data);
```

## Core Types

### Result<T, E>
```typescript
type Result<T, E = Error> = Ok<T> | Err<E>;
```

A discriminated union that represents either success or failure.

### Ok<T>
```typescript
interface Ok<T> {
    success: true;
    data: T;
}
```

Represents a successful operation with data of type `T`.

### Err<E>
```typescript
interface Err<E = Error> {
    success: false;
    error: E;
}
```

Represents a failed operation with error of type `E`.

## Basic Usage

### Creating Results

```typescript
import { ok, err, type Result } from "@/util/resultutil";

function divide(a: number, b: number): Result<number, string> {
    if (b === 0) {
        return err("Division by zero");
    }
    return ok(a / b);
}
```

### Checking Results (Type Guards)

**Always use `isOk()` and `isErr()` for proper type narrowing:**

```typescript
import { isOk, isErr } from "@/util/resultutil";

const result = divide(10, 2);

if (isOk(result)) {
    // TypeScript knows result.data exists and is number
    console.log("Result:", result.data);
} else if (isErr(result)) {
    // TypeScript knows result.error exists and is string
    console.error("Error:", result.error);
}
```

**Why not use `result.success`?**
```typescript
// ❌ TypeScript doesn't always narrow types correctly
if (result.success) {
    console.log(result.data); // Might still cause TS errors
}

// ✅ Type guards provide proper type narrowing
if (isOk(result)) {
    console.log(result.data); // Always works
}
```

## Helper Functions

### safeAsync - Wrap async operations

```typescript
import { safeAsync } from "@/util/resultutil";

const result = await safeAsync(async () => {
    return await RpcApi.SomeCommand(client, data);
});

if (isErr(result)) {
    console.error("Failed:", result.error); // string error message
    return;
}
console.log("Success:", result.data);
```

### safeAsyncError - Preserve Error objects

```typescript
import { safeAsyncError } from "@/util/resultutil";

const result = await safeAsyncError(async () => {
    return await RpcApi.SomeCommand(client, data);
});

if (isErr(result)) {
    // result.error is full Error object with stack trace
    console.error("Failed:", result.error.message);
    console.error("Stack:", result.error.stack);
    return;
}
```

### safeSync - Wrap synchronous operations

```typescript
import { safeSync } from "@/util/resultutil";

const result = safeSync(() => JSON.parse(jsonString));

if (isErr(result)) {
    console.error("Parse failed:", result.error);
    return;
}
console.log("Parsed:", result.data);
```

### mapResult - Transform success values

```typescript
import { mapResult } from "@/util/resultutil";

const userResult = await getUser(id);
const nameResult = mapResult(userResult, user => user.name);

if (isOk(nameResult)) {
    console.log("Name:", nameResult.data); // string
}
```

### chainResult - Chain dependent operations

```typescript
import { chainResult } from "@/util/resultutil";

const result1 = await getUserResult(id);
const result2 = chainResult(result1, user => getProfileResult(user.id));

// If result1 failed, result2 contains the same error
// If result1 succeeded, result2 contains profile result
if (isErr(result2)) {
    showError(result2.error);
    return;
}
console.log("Profile:", result2.data);
```

### unwrap - Extract value (use sparingly)

```typescript
import { unwrap } from "@/util/resultutil";

// Only use when you're CERTAIN it's Ok
const data = unwrap(result); // throws if Err
```

### unwrapOr - Provide default value

```typescript
import { unwrapOr } from "@/util/resultutil";

const name = unwrapOr(nameResult, "Unknown");
// Always returns a value, never throws
```

## Real-World Examples

### Example 1: Connection Establishment

```typescript
import { safeAsync, isErr } from "@/util/resultutil";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

async function connectToRemote(
    connName: string,
    blockId: string
): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.ConnConnectCommand(
            TabRpcClient,
            { host: connName, logblockid: blockId },
            { timeout: 60000 }
        );
    });
}

// Usage in component
const handleConnect = async () => {
    setIsConnecting(true);
    const result = await connectToRemote(connection, blockId);

    if (isErr(result)) {
        showErrorNotification("Connection Failed", result.error);
        setConnectionError(result.error);
        setIsConnecting(false);
        return;
    }

    // Success - connection established
    setConnectionError("");
    setIsConnecting(false);
};
```

### Example 2: File Operations

```typescript
import { safeAsync, isErr, isOk } from "@/util/resultutil";

async function saveFile(path: string, data: string): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.FileWriteCommand(TabRpcClient, {
            info: { path },
            data64: btoa(data)
        });
    });
}

// Usage with proper error handling
const result = await saveFile(filePath, content);

if (isErr(result)) {
    if (result.error.includes("permission denied")) {
        showErrorNotification(
            "Permission Denied",
            "You don't have write access to this file"
        );
    } else {
        showErrorNotification("Save Failed", result.error);
    }
    return false;
}

showSuccessNotification("File saved successfully");
return true;
```

### Example 3: AI Operations with Rate Limiting

```typescript
import { safeAsync, isErr } from "@/util/resultutil";

async function sendAIMessage(
    chatId: string,
    message: string
): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.AiSendMessageCommand(TabRpcClient, {
            chatid: chatId,
            message: message
        });
    });
}

// Usage with specific error handling
const result = await sendAIMessage(chatId, userMessage);

if (isErr(result)) {
    if (result.error.includes("rate limit")) {
        showWarningNotification(
            "Rate Limited",
            "Please wait before sending another message"
        );
    } else if (result.error.includes("quota")) {
        showErrorNotification(
            "Quota Exceeded",
            "You've reached your AI message limit for today"
        );
    } else {
        showErrorNotification("AI Error", result.error);
    }
    return;
}

// Message sent successfully
scrollToBottom();
```

### Example 4: Chaining Multiple Operations

```typescript
import { safeAsync, isErr, isOk } from "@/util/resultutil";

async function saveImageToDirectory(
    imageData: string,
    filename: string,
    baseDir: string
): Promise<Result<string, string>> {
    // Step 1: Create directory
    const mkdirResult = await safeAsync(async () => {
        await RpcApi.FileMkdirCommand(TabRpcClient, {
            info: { path: `${baseDir}/.wave/images` }
        });
    });

    // Tolerate "already exists" errors
    if (isErr(mkdirResult) && !mkdirResult.error.toLowerCase().includes("exist")) {
        return err(`Failed to create directory: ${mkdirResult.error}`);
    }

    // Step 2: Write file
    const writeResult = await safeAsync(async () => {
        await RpcApi.FileWriteCommand(TabRpcClient, {
            info: { path: `${baseDir}/.wave/images/${filename}` },
            data64: imageData
        });
    });

    if (isErr(writeResult)) {
        return err(`Failed to write file: ${writeResult.error}`);
    }

    // Return relative path for markdown
    return ok(`.wave/images/${filename}`);
}

// Usage
const result = await saveImageToDirectory(base64Data, filename, tabBasedir);

if (isErr(result)) {
    showErrorNotification("Failed to save image", result.error);
    return null;
}

// Use the markdown path
insertText(`![](${result.data})`);
```

## Migration Strategy

### Phase 1: New Code
- All new RPC operations should return Result types
- Use `safeAsync` for all new async operations

### Phase 2: Critical Paths
1. **Connection establishment** (highest priority - prevents connection failures)
2. **File operations** (prevents data loss)
3. **AI operations** (handles rate limiting gracefully)
4. **Settings saves** (prevents lost configuration)

### Phase 3: Gradual Conversion
- Create Result-returning wrappers for existing operations
- Update call sites one at a time
- Don't break existing code - both patterns can coexist

### Example Migration

**Before:**
```typescript
async function loadGitBashPath() {
    try {
        const path = await RpcApi.FindGitBashCommand(TabRpcClient, false);
        globalStore.set(gitBashPathAtom, path);
    } catch (error) {
        console.error("Failed to find git bash:", error);
        globalStore.set(gitBashPathAtom, "");
    }
}
```

**After:**
```typescript
import { safeAsync, isOk, isErr } from "@/util/resultutil";

async function loadGitBashPath() {
    const result = await safeAsync(async () => {
        return await RpcApi.FindGitBashCommand(TabRpcClient, false);
    });

    if (isOk(result)) {
        globalStore.set(gitBashPathAtom, result.data);
    } else if (isErr(result)) {
        // Don't notify user - this is background detection
        console.log("Git Bash not found:", result.error);
        globalStore.set(gitBashPathAtom, "");
    }
}
```

## Best Practices

### ✅ DO

1. **Use type guards (`isOk`, `isErr`) for type narrowing**
   ```typescript
   if (isErr(result)) {
       // Properly narrows type
   }
   ```

2. **Provide specific error messages**
   ```typescript
   if (isErr(result)) {
       if (result.error.includes("permission")) {
           showErrorNotification("Permission Denied", "...");
       } else {
           showErrorNotification("Operation Failed", result.error);
       }
   }
   ```

3. **Return early on errors**
   ```typescript
   if (isErr(result)) {
       showError(result.error);
       return; // Exit early
   }
   // Continue with success path
   ```

4. **Chain operations with chainResult**
   ```typescript
   const finalResult = await chainResultAsync(
       result1,
       async (data) => await nextOperation(data)
   );
   ```

### ❌ DON'T

1. **Don't silently ignore errors**
   ```typescript
   // ❌ Bad
   if (isErr(result)) {
       // Do nothing
   }

   // ✅ Good
   if (isErr(result)) {
       console.error("Operation failed:", result.error);
       showErrorNotification("Failed", result.error);
   }
   ```

2. **Don't use unwrap() without good reason**
   ```typescript
   // ❌ Bad - could throw
   const data = unwrap(result);

   // ✅ Good - explicit error handling
   if (isErr(result)) {
       handleError(result.error);
       return;
   }
   const data = result.data;
   ```

3. **Don't overuse try-catch with Results**
   ```typescript
   // ❌ Bad - defeats the purpose
   try {
       const result = await operation();
       if (isErr(result)) { ... }
   } catch (e) { ... }

   // ✅ Good - Result type handles errors
   const result = await operation();
   if (isErr(result)) { ... }
   ```

## API Reference

See `frontend/util/resultutil.ts` for complete API documentation.

### Core Functions
- `ok<T>(data: T): Ok<T>`
- `err<E>(error: E): Err<E>`
- `isOk<T, E>(result: Result<T, E>): result is Ok<T>`
- `isErr<T, E>(result: Result<T, E>): result is Err<E>`

### Wrapper Functions
- `safeAsync<T>(fn: () => Promise<T>): Promise<Result<T, string>>`
- `safeAsyncError<T>(fn: () => Promise<T>): Promise<Result<T, Error>>`
- `safeSync<T>(fn: () => T): Result<T, string>`

### Transform Functions
- `mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E>`
- `chainResult<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E>`
- `chainResultAsync<T, U, E>(result: Result<T, E>, fn: (data: T) => Promise<Result<U, E>>): Promise<Result<U, E>>`

### Utility Functions
- `unwrap<T, E>(result: Result<T, E>): T`
- `unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T`
- `allOk<T, E>(results: Result<T, E>[]): boolean`
- `getOkValues<T, E>(results: Result<T, E>[]): T[]`
- `getErrValues<T, E>(results: Result<T, E>[]): E[]`

## Testing

Tests are in `frontend/util/resultutil.test.ts`. Run with:

```bash
npm test -- resultutil.test.ts
```

All 30 tests pass, covering:
- Type constructors (ok, err)
- Async wrappers (safeAsync, safeAsyncError)
- Sync wrappers (safeSync)
- Transformations (mapResult, chainResult)
- Utilities (unwrap, unwrapOr)
- Type narrowing and safety

## Resources

- **Implementation**: `frontend/util/resultutil.ts`
- **Tests**: `frontend/util/resultutil.test.ts`
- **Examples**: `frontend/util/resultutil.examples.ts`
- **This Guide**: `frontend/util/RESULT_TYPE_GUIDE.md`

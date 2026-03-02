# Integration Tests

This directory contains end-to-end integration tests for critical security paths in Wave Terminal.

## Overview

Integration tests validate that multiple components work together correctly to enforce security boundaries and provide proper error handling. These tests focus on real-world user flows that cross architectural boundaries (frontend ↔ IPC ↔ backend).

## Test Suites

### critical-paths.test.ts

**Purpose:** Validates critical security safeguards and error handling mechanisms

**Test Categories:**

1. **SSH Connection Security (CONN-001)**
   - Plaintext password blocking
   - Secure credential storage enforcement
   - Error message clarity
   - Connection error propagation

2. **WSL Terminal Launch**
   - Valid distro validation
   - Invalid distro error handling
   - UNC path format validation
   - Path format rejection

3. **IPC Security Boundary**
   - Path traversal prevention in `open-native-path`
   - UNC path blocking on Windows
   - Home directory boundary enforcement
   - Download URI validation
   - wsh:// protocol enforcement

4. **Error Recovery Flow**
   - React error boundary functionality
   - Tab-level error isolation
   - App-level error catching
   - Error recovery/reset mechanisms
   - Error logging and context

## Running Tests

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test critical-paths.test.ts
```

### Run with Coverage

```bash
npm run coverage
```

### Run in Watch Mode

```bash
npm test -- --watch
```

## Test Results

After running tests, view the detailed report:

```
__tests__/integration/TEST_REPORT.md
```

JUnit XML report is generated at:

```
test-results.xml
```

## Writing New Integration Tests

### Test Structure

Integration tests should follow this structure:

```typescript
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

describe("Feature Name", () => {
  describe("Specific Behavior", () => {
    it("should validate expected outcome", async () => {
      // Arrange
      const input = setupTestData();

      // Act
      const result = await testFunction(input);

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Best Practices

1. **Test Real Flows:** Integration tests should simulate real user workflows
2. **Avoid Mocking Core Logic:** Mock external dependencies (electron, fs), not business logic
3. **Clear Assertions:** Use descriptive expect messages
4. **Error Cases:** Test both success and failure paths
5. **Security Focus:** Prioritize security-critical paths
6. **Documentation:** Comment why a test exists, especially for security tests

### Example: Testing Security Boundary

```typescript
it("should block path traversal attempts", async () => {
  const validatePath = (path: string): Error | null => {
    const homeDir = "/home/testuser";
    const resolvedPath = resolvePath(path);

    if (!resolvedPath.startsWith(homeDir)) {
      return new Error("Path outside home directory not allowed");
    }

    return null;
  };

  // Test path traversal
  const result = validatePath("../../../etc/passwd");

  expect(result).toBeInstanceOf(Error);
  expect(result?.message).toContain("outside home directory");
});
```

## Debugging Tests

### Verbose Output

```bash
npm test -- --reporter=verbose
```

### Debug Single Test

```bash
npm test -- --run --reporter=verbose critical-paths.test.ts
```

### View Console Logs

Console logs from tests are displayed in the output. Use `console.log()` for debugging.

### Inspect Test Report

Check `TEST_REPORT.md` for detailed results, including:
- Test status (pass/fail)
- Error messages
- Security validation results
- Performance metrics

## CI/CD Integration

These tests are designed to run in CI/CD pipelines. The JUnit XML output (`test-results.xml`) can be consumed by most CI systems.

### GitHub Actions Example

```yaml
- name: Run Integration Tests
  run: npm run test:integration

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: test-results
    path: test-results.xml
```

## Test Maintenance

### When to Update Tests

Update integration tests when:
- Security requirements change
- New IPC handlers are added
- Authentication/authorization logic changes
- Error boundary behavior changes
- WSL or connection handling changes

### Failing Tests

If a test fails:

1. **Don't Disable It:** Fix the underlying issue
2. **Investigate Root Cause:** Why did the behavior change?
3. **Security Tests:** Failing security tests may indicate a vulnerability
4. **Update Documentation:** If requirements changed, update TEST_REPORT.md

## Security Safeguards Tested

### CONN-001: SSH Password Security

**Requirement:** Prevent plaintext password storage

**Implementation:**
- Block `ssh:password` field in connection metadata
- Block `ssh:keypassphrase` field in connection metadata
- Enforce use of `ssh:passwordsecretname` for passwords
- Enforce use of secretstore for key passphrases

**Tests:**
- `should block attempt to store plaintext password`
- `should block attempt to store plaintext key passphrase`
- `should succeed with password secret name`

### Path Traversal Prevention

**Requirement:** Prevent directory traversal attacks

**Implementation:**
- Resolve paths to absolute paths
- Check if resolved path is within home directory
- Block UNC paths on Windows
- Validate URI formats for download operations

**Tests:**
- `should block path traversal attempts`
- `should block UNC paths on Windows`
- `should allow valid file paths within home directory`
- `should block path traversal in download URLs`

### WSL Security

**Requirement:** Validate WSL distro and path format

**Implementation:**
- Validate distro name against available distros
- Enforce UNC path format: `\\wsl.localhost\<distro>\<path>`
- Provide clear error messages for invalid distros

**Tests:**
- `should launch terminal with valid WSL distro`
- `should block invalid/deleted WSL distro with clear error`
- `should validate paths using UNC format for WSL`

### Error Boundaries

**Requirement:** Graceful error handling and recovery

**Implementation:**
- Tab-level ErrorBoundary for isolated failures
- Root-level ErrorBoundary for critical errors
- Error reset/reload mechanism
- Error logging with context

**Tests:**
- `should catch React errors in tab boundary`
- `should recover tab after reload`
- `should catch app-level errors in root boundary`

## Related Documentation

- `COMPREHENSIVE_BUG_AUDIT.md` - Security audit report
- `pkg/waveobj/validators.go` - Path validation implementation
- `emain/emain-ipc.ts` - IPC security handlers
- `pkg/wconfig/settingsconfig.go` - CONN-001 implementation
- `frontend/app/element/errorboundary.tsx` - Error boundary component

## Questions?

For questions about integration tests:
1. Check this README
2. Review TEST_REPORT.md for test results
3. Read the test source code (it's well-commented)
4. Check related Go tests (e.g., `pkg/wconfig/settingsconfig_test.go`)

## License

Copyright 2025, Command Line Inc.
SPDX-License-Identifier: Apache-2.0

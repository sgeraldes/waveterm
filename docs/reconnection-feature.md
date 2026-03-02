# Terminal Reconnection Feature

## Overview

Wave Terminal now includes automatic reconnection for SSH terminals that experience connection drops. When an SSH connection is lost unexpectedly, Wave will automatically attempt to reconnect, preserving your terminal history.

## Features

### Automatic Reconnection Detection

The terminal automatically detects when an SSH connection drops by monitoring:
- Process status transitions from "running" to "done"
- Non-zero exit codes (common SSH error codes: 255, 130, 143)
- Connection type (SSH vs local)

### Auto-Reconnect with Exponential Backoff

When a connection drop is detected:

1. **Initial delay**: 5 seconds before first reconnection attempt
2. **Retry schedule**: 3 automatic attempts total
   - Attempt 1: After 5 seconds
   - Attempt 2: After 10 seconds
   - Attempt 3: After 20 seconds
3. **Exponential backoff**: Delay doubles after each failed attempt

### UI Indicators

The connection status overlay shows:
- Countdown timer before reconnection ("Reconnecting in 5s...")
- Current attempt number ("Reconnecting... attempt 2/3")
- Ability to cancel automatic reconnection
- Manual reconnect button
- Clear status messages

### Terminal History Preservation

- Terminal output is preserved during disconnection
- No data loss when reconnection succeeds
- Scrollback buffer remains intact

## User Interface

### During Reconnection

When a connection drops, you'll see an overlay at the top of the terminal:

```
⚠️ Connection lost. Reconnecting in 5s...     [Cancel]
```

While attempting to reconnect:

```
⚠️ Reconnecting to "user@host" (attempt 2/3)...     [Cancel]
```

After all attempts fail:

```
⚠️ Failed to reconnect to "user@host" after 3 attempts     [Reconnect]
```

### User Actions

- **Cancel**: Stop automatic reconnection attempts
- **Reconnect**: Manually trigger immediate reconnection (bypasses countdown)

## Technical Implementation

### Frontend (TypeScript)

**File**: `frontend/app/view/term/term-model.ts`

New state atoms:
- `reconnectionState`: "idle" | "pending" | "attempting" | "failed"
- `reconnectAttempts`: Current attempt number (0-3)
- `reconnectTimer`: Countdown timer in seconds
- `showReconnectPrompt`: Whether to show reconnection UI

Key methods:
- `handleConnectionDrop()`: Detects drops and schedules reconnection
- `scheduleReconnect()`: Sets up timer with exponential backoff
- `attemptReconnect()`: Executes reconnection attempt
- `handleReconnectSuccess()`: Cleans up on successful reconnection
- `manualReconnect()`: User-triggered immediate reconnection
- `cancelReconnectTimer()`: Cancels pending reconnection

**File**: `frontend/app/block/connstatusoverlay.tsx`

Enhanced overlay to display:
- Reconnection countdown
- Attempt progress (X/3)
- Cancel button during auto-reconnect
- Manual reconnect button when failed

### Backend (Go)

**File**: `pkg/blockcontroller/shellcontroller.go`

Enhanced terminal messages to distinguish:
- Exit code 255: "connection error"
- Exit codes 130/143: "interrupted"
- Other non-zero: Generic exit code message

This helps users understand why a connection dropped.

## Connection Drop Detection Logic

A connection drop is detected when **ALL** of these conditions are met:

1. **Previous status**: Process was "running"
2. **Current status**: Process is now "done"
3. **Has connection**: Block has a connection name set
4. **Is remote**: Connection is not local (not "", "local", or "local:*")
5. **Non-zero exit**: Exit code is not 0

Common SSH exit codes:
- **255**: SSH connection error (network/auth failure)
- **130**: Interrupted (Ctrl+C / SIGINT)
- **143**: Terminated (SIGTERM)

## Configuration

Currently there are no user-configurable settings for reconnection behavior. The following are hardcoded:

- Initial delay: 5 seconds
- Max attempts: 3
- Backoff multiplier: 2x (5s, 10s, 20s)

Future enhancements may add settings to customize these values.

## Testing

To test the reconnection feature:

1. **Start SSH connection**:
   ```bash
   # Create a new terminal block with SSH connection
   # Or use existing SSH terminal
   ```

2. **Simulate connection drop**:
   - Method 1: Kill SSH process on remote server
   - Method 2: Disconnect network temporarily
   - Method 3: Use `kill` on the SSH client process

3. **Verify automatic reconnection**:
   - Observe countdown overlay appears
   - Wait for first reconnection attempt (5s)
   - Check that retry attempts use exponential backoff

4. **Test manual reconnection**:
   - Click "Cancel" during countdown
   - Click "Reconnect" to manually reconnect

5. **Test failure case**:
   - Keep connection unavailable through all 3 attempts
   - Verify "Failed to reconnect" message
   - Verify "Reconnect" button appears

6. **Verify history preservation**:
   - Run some commands before disconnect
   - After reconnection, scroll up
   - Confirm all previous output is visible

## Known Limitations

1. **Clean exits not detected**: If user types `exit`, terminal shows as "done" but doesn't trigger reconnection (working as intended)

2. **Local connections**: Reconnection only applies to SSH connections, not local shells or WSL

3. **WSL connections**: Not currently supported for auto-reconnection

4. **No persistent retry**: After 3 failed attempts, must manually reconnect

5. **No configuration**: Timing and retry counts are hardcoded

## Future Enhancements

Potential improvements:
- User-configurable retry count and timing
- Support for WSL connection reconnection
- Persistent reconnection (retry indefinitely until success)
- Network health monitoring for smarter retry logic
- Connection quality indicators
- Toast notifications for reconnection events

## Error Handling

If reconnection fails after all attempts:
1. Terminal remains in "done" state
2. Error overlay shows "Failed to reconnect" message
3. User can manually retry using "Reconnect" button
4. Connection status overlay remains visible
5. Terminal history is preserved

## Code Organization

```
frontend/
  app/
    view/
      term/
        term-model.ts          # Core reconnection logic
    block/
      connstatusoverlay.tsx    # Reconnection UI overlay

pkg/
  blockcontroller/
    shellcontroller.go         # Enhanced error messages
```

## Related Issues

This feature resolves:
- **TM-005**: Terminal doesn't reconnect after connection drops

## See Also

- Connection Status Documentation
- Terminal Block Documentation
- SSH Connection Management

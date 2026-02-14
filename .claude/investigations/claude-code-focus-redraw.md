# Claude Code CLI Focus-Based Redraw Behavior Investigation

## Summary

Claude Code CLI uses the Ink TUI library (React for terminals) which subscribes to terminal focus events via DEC Private Mode 1004. When the terminal gains or loses focus, xterm.js sends `ESC[I` (focus in) or `ESC[O` (focus out) escape sequences. Claude Code receives these and triggers React state updates, which cause re-renders.

The repeated redraw behavior in Wave Terminal (xterm.js) vs single redraw in Windows Terminal is likely due to differences in how focus events are detected and reported.

## Claude Code CLI Location

```
Executable: C:\Users\Sebastian\.local\bin\claude.exe
Version storage: %APPDATA%\claude\claude-code\2.1.20\
```

The executable is a bundled Node.js application compiled with pkg or similar tool, containing minified JavaScript.

## Key Focus-Related Code Found in Claude Code

### 1. Terminal Mode Constants

```javascript
w2 = {
    CURSOR_VISIBLE: 25,
    ALT_SCREEN: 47,
    ALT_SCREEN_CLEAR: 1049,
    MOUSE_NORMAL: 1000,
    MOUSE_BUTTON: 1002,
    MOUSE_ANY: 1003,
    FOCUS_EVENTS: 1004,           // DEC Private Mode for focus reporting
    BRACKETED_PASTE: 2004,
    SYNCHRONIZED_UPDATE: 2026     // DEC Private Mode for synchronized output
}
```

### 2. Focus Event Detection

```javascript
// Focus in sequence: ESC[I
IVD = sB("I")  // "\x1b[I"

// Focus out sequence: ESC[O
fVD = sB("O")  // "\x1b[O"
```

### 3. Focus Event Handling (Ink TUI)

```javascript
function fp0(H, $, A, L) {
    for (let D of $) {
        let I = D.sequence;

        // Focus In event
        if (I === IVD) {
            H.handleTerminalFocus(true);
            let E = new UOH("terminalfocus");
            H.internal_eventEmitter.emit("terminalfocus", E);
            continue;
        }

        // Focus Out event
        if (I === fVD) {
            H.handleTerminalFocus(false);
            let E = new UOH("terminalblur");
            H.internal_eventEmitter.emit("terminalblur", E);
            continue;
        }
        // ...
    }
}
```

### 4. State Update on Focus Change

```javascript
handleTerminalFocus = (H) => {
    GUD(H);  // Global focus state update
    this.setState(($) => {
        if ($.isTerminalFocused === H) return $;  // No change, skip render
        return { ...$, isTerminalFocused: H };    // State change triggers re-render
    });
};
```

### 5. React Context Provider

```javascript
// TerminalFocusContext provides focus state to all Ink components
jWD = yWD.createContext({ isTerminalFocused: true });
jWD.displayName = "TerminalFocusContext";
```

## xterm.js Focus Event Flow

In Wave Terminal's xterm.js 6.1.0, focus events work as follows:

### Focus In (`_handleTextAreaFocus`):
```typescript
private _handleTextAreaFocus(ev: FocusEvent): void {
    if (this.coreService.decPrivateModes.sendFocus) {
        this.coreService.triggerDataEvent(C0.ESC + '[I');  // Send ESC[I to app
    }
    this.element!.classList.add('focus');
    this._showCursor();
    this._onFocus.fire();
}
```

### Focus Out (`_handleTextAreaBlur`):
```typescript
private _handleTextAreaBlur(): void {
    this.textarea!.value = '';
    this.refresh(this.buffer.y, this.buffer.y);  // Refresh current line
    if (this.coreService.decPrivateModes.sendFocus) {
        this.coreService.triggerDataEvent(C0.ESC + '[O');  // Send ESC[O to app
    }
    this.element!.classList.remove('focus');
    this._onBlur.fire();
}
```

## Why Wave Terminal May Trigger Repeated Redraws

### Potential Causes

1. **Multiple Focus Events**
   - Wave Terminal's architecture with multiple blocks/views may cause focus to cascade
   - Each block has its own textarea that can gain/lose focus
   - Clicking anywhere in the Wave window may trigger focus events for multiple elements

2. **Tab/Window Focus vs Terminal Focus**
   - Wave Terminal tracks focus at multiple levels:
     - Window focus (Electron BrowserWindow)
     - Tab focus (which workspace tab is active)
     - Block focus (which block within the tab)
     - Terminal focus (the xterm.js textarea)
   - Each level change could potentially trigger the terminal's focus events

3. **xterm.js Textarea Focus Behavior**
   - xterm.js uses a hidden textarea for keyboard input
   - In Wave Terminal, clicking the terminal block may trigger focus, blur, focus sequence
   - The block frame header interactions could cause focus changes

4. **React/Jotai State Propagation**
   - Wave Terminal uses Jotai for state management
   - Focus state changes propagate through the atom tree
   - This could cause multiple renders that affect the terminal

### Windows Terminal Difference

Windows Terminal likely:
- Has simpler focus architecture (one terminal per tab, no blocks)
- Uses native Windows focus events directly
- May not expose terminal focus in the same way to the PTY

## DEC Mode 2026 (Synchronized Output) Interaction

Claude Code uses synchronized output (`[?2026h` / `[?2026l`) to reduce flicker during redraws. However, this doesn't prevent the redraw itself - it just makes it smoother.

Wave Terminal has enabled DEC mode 2026 support in xterm.js 6.1.0, which should help with the visual artifacts but doesn't address the root cause of multiple focus events.

## Recommendations for Wave Terminal

### 1. Debounce Focus Events to PTY

Consider adding a debounce mechanism in the terminal wrapper that consolidates rapid focus in/out sequences:

```typescript
// In termwrap.ts
private focusDebounceTimer: NodeJS.Timeout | null = null;
private lastFocusState: boolean | null = null;

private debouncedSendFocusEvent(focused: boolean) {
    if (this.focusDebounceTimer) {
        clearTimeout(this.focusDebounceTimer);
    }

    this.focusDebounceTimer = setTimeout(() => {
        if (this.lastFocusState !== focused) {
            // Only send if state actually changed
            const seq = focused ? '\x1b[I' : '\x1b[O';
            this.sendDataHandler?.(seq);
            this.lastFocusState = focused;
        }
    }, 50);  // 50ms debounce
}
```

### 2. Track Terminal Focus Separately

Ensure that terminal focus is distinct from block/tab focus:

```typescript
// Only consider terminal focused when:
// 1. Window is focused
// 2. Tab is active
// 3. Block is focused
// 4. Terminal textarea has actual DOM focus
const isTerminalTrulyFocused =
    document.hasFocus() &&
    isActiveTab &&
    blockModel.isFocused &&
    terminal.textarea === document.activeElement;
```

### 3. Investigate Focus Event Sources

Add logging to identify the source of focus events:

```typescript
this.terminal.onFocus(() => {
    console.log('Terminal focus event', {
        activeElement: document.activeElement,
        hasFocus: document.hasFocus(),
        blockFocused: globalStore.get(this.nodeModel.isFocused)
    });
});
```

## Files of Interest

| File | Purpose |
|------|---------|
| `frontend/app/view/term/termwrap.ts` | Terminal wrapper, handles OSC events |
| `frontend/app/view/term/term-model.ts` | Terminal model, focus management |
| `frontend/app/store/focusManager.ts` | Global focus management |
| `frontend/app/block/blocktypes.ts` | Block focus state (isFocused atom) |
| `node_modules/@xterm/xterm/src/browser/CoreBrowserTerminal.ts` | xterm.js focus handling |

## Conclusion

The repeated focus redraw behavior in Wave Terminal is likely caused by the multi-level focus architecture (window -> tab -> block -> terminal) triggering multiple focus events that propagate to Claude Code's Ink TUI. Each focus event causes a React state update and re-render.

Windows Terminal's simpler single-terminal-per-tab architecture avoids this issue by having only one focus boundary.

A debounce mechanism or more careful focus event filtering in Wave Terminal's terminal wrapper would mitigate this issue.

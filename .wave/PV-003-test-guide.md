# Manual Test Guide: PV-003 - File Watch Auto-Refresh

## Prerequisites
- Wave Terminal built with file watching feature
- A local text file (Markdown, code, or CSV)
- An external text editor (VS Code, Notepad++, etc.)

## Test 1: Markdown File Auto-Refresh

**Setup:**
1. Create a test markdown file:
   ```bash
   echo "# Test Heading" > ~/test-watch.md
   ```
2. Open the file in Wave Terminal preview
3. Verify the file displays correctly

**Test Steps:**
1. Open the same file in an external editor
2. Add a new line: `## New Section`
3. Save the file
4. **Expected Result:** Preview refreshes within ~300ms showing the new content
5. Try rapid edits (multiple saves within 1 second)
6. **Expected Result:** Debouncing prevents multiple refreshes, only final content shown

**Cleanup:**
```bash
rm ~/test-watch.md
```

## Test 2: Code File Auto-Refresh

**Setup:**
1. Create a test JavaScript file:
   ```bash
   cat > ~/test-watch.js << 'EOF'
   function hello() {
       console.log("Hello");
   }
   EOF
   ```
2. Open in Wave Terminal preview (code edit view)

**Test Steps:**
1. Open file in external editor
2. Add a new function:
   ```javascript
   function world() {
       console.log("World");
   }
   ```
3. Save the file
4. **Expected Result:** Code editor refreshes automatically
5. Verify cursor position and scroll are maintained reasonably

**Cleanup:**
```bash
rm ~/test-watch.js
```

## Test 3: CSV File Auto-Refresh

**Setup:**
1. Create a test CSV file:
   ```bash
   cat > ~/test-watch.csv << 'EOF'
   Name,Age,City
   Alice,30,NYC
   Bob,25,LA
   EOF
   ```
2. Open in Wave Terminal preview

**Test Steps:**
1. Open file in external editor
2. Add a new row: `Charlie,35,Chicago`
3. Save the file
4. **Expected Result:** CSV preview updates automatically
5. Verify table re-renders correctly

**Cleanup:**
```bash
rm ~/test-watch.csv
```

## Test 4: Directory View (No Auto-Refresh)

**Setup:**
1. Open a directory in preview: `~/Documents`

**Test Steps:**
1. Create a new file in that directory using external tool
2. **Expected Result:** Directory view does NOT auto-refresh (directories not watched)
3. Click manual refresh button
4. **Expected Result:** New file appears

## Test 5: Remote File (No Auto-Refresh)

**Setup:**
1. Connect to an SSH remote
2. Open a file on the remote in preview

**Test Steps:**
1. Edit the file on the remote server (via SSH)
2. **Expected Result:** Preview does NOT auto-refresh (remote watching not implemented)
3. Use manual refresh button to see changes

## Test 6: View Type Change

**Setup:**
1. Open a markdown file in preview mode (rendered)

**Test Steps:**
1. Edit file externally
2. **Expected Result:** Preview auto-refreshes (markdown view is watched)
3. Click "Edit" button to switch to code editor
4. Edit file externally again
5. **Expected Result:** Still auto-refreshes (codeedit view is also watched)
6. Switch back to preview mode
7. **Expected Result:** Auto-refresh continues working

## Test 7: Block Closure Cleanup

**Setup:**
1. Open a file in preview
2. Verify file watching is active (edit externally, see refresh)

**Test Steps:**
1. Close the preview block
2. **Expected Result:** Backend removes watch entry (check logs)
3. Edit file externally
4. **Expected Result:** No WPS events published (no active watchers)

## Test 8: Multiple Blocks Same File

**Setup:**
1. Create two preview blocks viewing the same file
2. Verify both show the file correctly

**Test Steps:**
1. Edit file externally
2. **Expected Result:** BOTH blocks refresh automatically
3. Close one block
4. Edit file again
5. **Expected Result:** Remaining block still refreshes
6. Close second block
7. **Expected Result:** Backend removes watch completely

## Test 9: File Deletion While Watching

**Setup:**
1. Open a file in preview
2. Verify auto-refresh works

**Test Steps:**
1. Delete the file externally: `rm ~/test-file.md`
2. **Expected Result:** Preview shows error or "file not found"
3. Create file again with new content: `echo "New content" > ~/test-file.md`
4. **Expected Result:** Preview may show error or need manual refresh (fsnotify Remove event handled)

## Test 10: Non-Existent File

**Setup:**
1. Open preview to a non-existent file path

**Test Steps:**
1. **Expected Result:** Preview shows error or empty state
2. Create the file externally
3. **Expected Result:** File watching not started (file didn't exist initially)
4. Manually refresh or reopen preview
5. **Expected Result:** Now shows file and starts watching

## Verification Checklist

- [ ] Markdown files auto-refresh
- [ ] Code files auto-refresh
- [ ] CSV files auto-refresh
- [ ] Directories do NOT auto-refresh
- [ ] Remote files do NOT auto-refresh
- [ ] Debouncing works (no rapid-fire refreshes)
- [ ] Multiple blocks watching same file both refresh
- [ ] Cleanup happens when block closes
- [ ] View type switching maintains auto-refresh
- [ ] Manual refresh button still works as fallback

## Expected Logs

When file watching is active, you should see logs like:
```
started watching file: /path/to/file.md for block: block-abc123
file change detected: /path/to/file.md (watching blocks: 1)
stopped watching file: /path/to/file.md
```

## Known Limitations

1. **Local only:** Remote files via SSH/WSL are not watched
2. **No visual indicator:** No UI shows that auto-refresh is active
3. **Directories not watched:** Only regular files are monitored
4. **Cursor reset:** Code editor cursor may reset to top after refresh

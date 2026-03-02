const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/49847712B72A5472E7678FD0FCE50E97');
let msgId = 1;
ws.on('open', () => {
  const expr = `
    // Check xterm instance via window.term (set in term.tsx)
    const termInfo = window.term ? {
      hasTerminal: true,
      rows: window.term.terminal.rows,
      cols: window.term.terminal.cols,
      loaded: window.term.loaded,
      ptyOffset: window.term.ptyOffset,
      dataBytesProcessed: window.term.dataBytesProcessed,
      hasResized: window.term.hasResized,
      heldDataLength: window.term.heldData ? window.term.heldData.length : -1,
      bufferLength: window.term.terminal.buffer ? window.term.terminal.buffer.active.length : -1,
    } : { hasTerminal: false };

    // Check xterm-screen dimensions
    const screens = document.querySelectorAll('.xterm-screen');
    let screenDims = [];
    screens.forEach((s, i) => {
      const rect = s.getBoundingClientRect();
      screenDims.push({
        idx: i,
        width: rect.width,
        height: rect.height,
        innerHTML: s.innerHTML.substring(0, 200),
        childCount: s.children.length,
        childClasses: Array.from(s.children).map(c => c.className).join(', ')
      });
    });

    // Check term-connectelem dimensions
    const connects = document.querySelectorAll('.term-connectelem');
    let connectDims = [];
    connects.forEach((c, i) => {
      const rect = c.getBoundingClientRect();
      connectDims.push({
        idx: i,
        width: rect.width,
        height: rect.height,
        childCount: c.children.length
      });
    });

    // Check for any error overlays
    const errorOverlays = document.querySelectorAll('.connstatus-overlay');
    const errorTexts = [];
    errorOverlays.forEach(o => errorTexts.push(o.textContent.substring(0, 100)));

    JSON.stringify({ termInfo, screenDims, connectDims, errorOverlays: errorOverlays.length, errorTexts }, null, 2)
  `;
  ws.send(JSON.stringify({ id: msgId++, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  setTimeout(() => { ws.close(); process.exit(0); }, 2000);
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1 && msg.result && msg.result.result) {
    console.log(msg.result.result.value || JSON.stringify(msg.result.result));
  }
});

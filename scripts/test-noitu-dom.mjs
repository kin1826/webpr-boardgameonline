import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 5178;
const vite = spawn('node_modules/.bin/vite', ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'banban-noitu-dom-'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForVite() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/tests/noitu-dom.html`)).ok) return; } catch { /* starting */ }
    await delay(100);
  }
  throw new Error('Vite chưa khởi động được trên cổng 5178.');
}

async function runChrome(width, reduced) {
  const browserProfile = join(profile, `${width}-${reduced}`);
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    `--user-data-dir=${browserProfile}`, '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let debugPort;
    for (let i = 0; i < 60; i++) {
      try { debugPort = Number((await readFile(join(browserProfile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); }
    }
    if (!debugPort) throw new Error('Chrome DevTools không khởi động.');
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('Không tìm thấy tab Chrome.');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 761 });
    if (width < 761) await call('Emulation.setTouchEmulationEnabled', { enabled: true });
    if (reduced) await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/tests/noitu-dom.html` });
    let status = 'running';
    for (let i = 0; i < 100; i++) {
      await delay(50);
      const result = await call('Runtime.evaluate', { expression: "document.querySelector('#results')?.dataset.status ?? 'running'", returnByValue: true });
      status = result.result.value;
      if (status !== 'running') break;
    }
    const result = await call('Runtime.evaluate', { expression: "document.querySelector('#results')?.textContent ?? 'Không có kết quả'", returnByValue: true });
    if (status !== 'pass') throw new Error(`Chrome ${width}px reduced=${reduced}: ${result.result.value}`);
    return result.result.value;
  } finally {
    ws?.close();
    await new Promise((resolve) => {
      if (browser.exitCode !== null || browser.signalCode !== null) { resolve(); return; }
      browser.once('exit', resolve);
      browser.kill('SIGTERM');
    });
  }
}

try {
  await waitForVite();
  for (const [width, reduced] of [[1440, false], [390, false], [360, false], [390, true]]) {
    console.log(await runChrome(width, reduced));
  }
} finally {
  vite.kill('SIGTERM');
  await rm(profile, { recursive: true, force: true });
}

// scripts/manualAcceptanceTest.js
// Phase 3E: Manual Browser Acceptance Testing Runner via Chrome DevTools Protocol (CDP)

const fs = require('fs');
const path = require('path');
const mongoose = require('../backend/node_modules/mongoose');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/pivot/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Global results store
const results = [];

// Helper: CDP Client over Native WebSocket
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleLogs = [];
    this.networkLogs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });

    this.ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
        if (data.method === 'Runtime.consoleAPICalled') {
          this.consoleLogs.push({
            type: data.params.type,
            text: (data.params.args || []).map(a => a.value || JSON.stringify(a)).join(' ')
          });
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.consoleLogs.push({
            type: 'error',
            text: data.params.exceptionDetails?.text || 'Uncaught Exception',
            details: data.params.exceptionDetails
          });
        } else if (data.method === 'Network.requestWillBeSent') {
          this.networkLogs.push({
            requestId: data.params.requestId,
            method: data.params.request.method,
            url: data.params.request.url,
            postData: data.params.request.postData,
            headers: data.params.request.headers,
            timestamp: Date.now()
          });
        } else if (data.method === 'Network.responseReceived') {
          const req = this.networkLogs.find(r => r.requestId === data.params.requestId);
          if (req) {
            req.status = data.params.response.status;
            req.statusText = data.params.response.statusText;
            req.mimeType = data.params.response.mimeType;
          }
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP Evaluate Error: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails)})`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filename) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
    return filePath;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    // Wait for network idle or load
    await new Promise(r => setTimeout(r, 2000));
  }

  clearLogs() {
    this.consoleLogs = [];
    this.networkLogs = [];
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('=== TripNow Phase 3E: Manual Browser Acceptance Testing ===');
  console.log('Connecting to local MongoDB on 127.0.0.1:27017/tripnow_manual_acceptance...');
  await mongoose.connect('mongodb://127.0.0.1:27017/tripnow_manual_acceptance');
  console.log('MongoDB connected.');

  // Access collections
  const Booking = mongoose.connection.collection('bookings');
  const User = mongoose.connection.collection('users');

  // Query Chrome CDP
  const version = await fetch('http://127.0.0.1:9222/json/version').then(r => r.json());
  console.log(`Connected to Google Chrome: ${version.Browser}`);

  const browserWs = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => browserWs.onopen = r);

  let bId = 1;
  const sendBrowser = (method, params = {}) => new Promise((res, rej) => {
    const id = bId++;
    const handler = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.id === id) {
        browserWs.removeEventListener('message', handler);
        if (d.error) rej(d.error);
        else res(d.result);
      }
    };
    browserWs.addEventListener('message', handler);
    browserWs.send(JSON.stringify({ id, method, params }));
  });

  // Create isolated target tab
  const { targetId } = await sendBrowser('Target.createTarget', { url: 'http://localhost:5173/' });
  console.log(`Created Chrome Tab target: ${targetId}`);

  const page = new CDPClient(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
  await page.connect();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Network.enable');

  console.log('Browser tab initialized and listeners registered.');

  // Run all 12 workflows
  return { page, browserWs, sendBrowser, targetId, Booking, User };
}

module.exports = { run, CDPClient, results, SCREENSHOT_DIR };


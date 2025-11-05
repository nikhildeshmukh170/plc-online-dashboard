import axios from "axios";
import ModbusRTU from "modbus-serial";

/*
 Demo bridge for PLC -> Cloud API

 - By default this script runs in DEMO mode (no PLC). To attempt a real PLC connection set:
   DEMO=false PLC_IP=192.168.0.10 PLC_PORT=502 node bridge.js

 - Configure cloud endpoint with CLOUD_API_URL or CLOUD_UPDATE_URL env var.
 - Configure polling interval with BRIDGE_POLL_SEC (seconds).

 The Modbus read example and mapping are left commented below for guidance when you
 connect a real PLC. The script will send a structured payload containing setpoints,
 timers, a short history, and a snapshot object.
*/

// Use environment variable when possible. The bridge will send per-tag updates to
// /api/plc/update on the same origin when possible (the cloud API expects single
// tag/value updates at POST /api/plc/update).
const RAW_CLOUD_API = process.env.CLOUD_API_URL || process.env.CLOUD_UPDATE_URL || "http://localhost:5000/api/plc/update";

// Derive a canonical update URL (POST single tag/value) from the provided value.
let CLOUD_UPDATE_URL = RAW_CLOUD_API;
try {
  const u = new URL(RAW_CLOUD_API);
  // use origin + known update path so bridge is compatible with the backend
  CLOUD_UPDATE_URL = `${u.origin}/api/plc/update`;
} catch (e) {
  // RAW_CLOUD_API might be a relative path already; fall back to it.
  CLOUD_UPDATE_URL = RAW_CLOUD_API;
}

// Demo mode: default to true so the bridge runs when no PLC is available.
// Set DEMO=false in the environment to attempt a real PLC connection.
const DEMO = process.env.DEMO !== 'false';

// PLC connection details (replace for real device)
const PLC_IP = process.env.PLC_IP || "192.168.0.10";
const PLC_PORT = Number(process.env.PLC_PORT || 502);

// Modbus client is available but we won't call it in demo mode.
const client = new ModbusRTU();

// --- Connect to PLC (only when not in demo mode) ---
async function connectPLC() {
  if (DEMO) {
    console.log('ℹ️ Running in DEMO mode — skipping PLC connection.');
    return false;
  }
  try {
    await client.connectTCP(PLC_IP, { port: PLC_PORT });
    console.log("✅ Connected to PLC:", PLC_IP);
    return true;
  } catch (error) {
    console.warn("⚠️ PLC connection failed:", error.message);
    return false;
  }
}

// Build a structured payload from the sample-like data the user supplied
function buildSamplePayload() {
  // Set points table (static configuration)
  const setpoints = [
    { tag: 'WFI-TST-01', units: '°C', LSP: 30, CSP: 70, HSP: 90 },
    { tag: 'WFI-TST-02', units: '°C', LSP: 3, CSP: 72, HSP: 92 },
    { tag: 'WFI-TST-03', units: '°C', LSP: 35, CSP: 75, HSP: 95 },
  ];

  // Timers / meta (static)
  const timers = [
    { name: 'STERILIZATION HOLD TIMER', units: 'Min', value: 1 },
    { name: 'CUMMULATIVE TIMER', units: 'Min', value: 10 },
    { name: 'DEPRESSURING TIMER', units: 'Min', value: 5 },
  ];

  // Generate a demo history series ending at "now" with small random variation so each poll
  // looks like a live stream. We'll create N rows spaced a few seconds apart.
  const rows = [];
  const now = Date.now();
  const base1 = 50; // starting base values for demo
  const base2 = 60;
  const base3 = 65;
  const N = 20;
  for (let i = N - 1; i >= 0; i--) {
    const ts = new Date(now - i * 3000); // 3 seconds apart
    // add small jitter over time
    const v1 = (base1 + (Math.random() * 4 - 2)).toFixed(2);
    const v2 = (base2 + (Math.random() * 4 - 2)).toFixed(2);
    const v3 = (base3 + (Math.random() * 4 - 2)).toFixed(2);
    // Determine a simple status based on value thresholds (demo logic)
    let status = 'RUNNING';
    if (Number(v1) > 71) status = 'STERILIZATION TIMER RUNNING';
    if (Number(v1) > 74) status = 'STERILIZATION TIMER COMPLETE';
    if (Math.random() < 0.05) status = 'EMPTYING STEP';

    rows.push({ datetime: ts.toISOString(), TST_01: Number(v1), TST_02: Number(v2), TST_03: Number(v3), cycle: '', status });
  }

  return { setpoints, timers, history: rows };
}

// --- Send payload to cloud API ---
async function sendPayload(payload) {
  // The cloud API currently accepts single tag/value updates at POST /api/plc/update.
  // When we have a snapshot with multiple values, send each tag individually so the
  // backend can store/update them.
  if (payload && payload.snapshot && payload.snapshot.values) {
    const values = payload.snapshot.values;
    const entries = Object.entries(values);
    try {
      for (const [tag, val] of entries) {
        const body = { tag, value: val };
        const res = await axios.post(CLOUD_UPDATE_URL, body, { timeout: 5000 });
        console.log(`📤 Updated ${tag} -> ${val} (status ${res.status})`);
      }
      // Optionally return something useful
      return { success: true, updated: entries.length };
    } catch (err) {
      console.error('❌ Error sending payload (per-tag):', err.message || err.toString());
      throw err;
    }
  }

  // Fallback: if no snapshot values present, attempt to POST the payload as-is to the
  // configured update URL (useful for single-tag payloads).
  try {
    const res = await axios.post(CLOUD_UPDATE_URL, payload, { timeout: 10000 });
    console.log(`📤 Sent payload to ${CLOUD_UPDATE_URL} — status ${res.status}`);
    return res.data;
  } catch (err) {
    console.error('❌ Error sending payload (fallback):', err.message || err.toString());
    throw err;
  }
}

// --- Read from PLC (or simulate) and create a payload ---
async function readAndSendData(demo = true) {
  try {
    // If running in real mode (DEMO=false) you would read Modbus registers here
    // and map them to tags. Example (commented):
    /*
    if (!DEMO) {
      // Example: read 6 registers starting at address 0
      const data = await client.readHoldingRegisters(0, 6);
      // Map registers to values (example mapping)
      const payload = buildSamplePayload();
      payload.snapshot = payload.snapshot || { timestamp: new Date().toISOString(), values: {} };
      payload.snapshot.values['WFI-TST-01'] = (data.data[0] / 100).toFixed(2); // if value scaled
      payload.snapshot.values['WFI-TST-02'] = (data.data[1] / 100).toFixed(2);
      payload.snapshot.values['WFI-TST-03'] = (data.data[2] / 100).toFixed(2);
      // ...additional parsing/mapping as needed
      await sendPayload(payload);
      return;
    }
    */

    // For demo mode: produce a structured payload similar to the sample you provided
    const payload = buildSamplePayload();

    // Optionally augment with a current snapshot
    payload.snapshot = {
      timestamp: new Date().toISOString(),
      values: {
        'WFI-TST-01': (Math.random() * 30 + 40).toFixed(2),
        'WFI-TST-02': (Math.random() * 30 + 40).toFixed(2),
        'WFI-TST-03': (Math.random() * 30 + 40).toFixed(2),
      }
    };

    // Print snapshot locally so user sees the randomized values in console
    console.log('🔎 Demo snapshot:', payload.snapshot.timestamp, payload.snapshot.values);

    // Send demo payload
    await sendPayload(payload);
  } catch (err) {
    console.error('⚠️ readAndSendData failed:', err.message || err.toString());
  }
}

// --- Start Process ---
async function start() {
  const ok = await connectPLC();
  console.log('🚀 Starting PLC data upload loop (demo=' + (!ok) + ')...');

  // send an initial full payload immediately
  await readAndSendData();

  // then repeat every N seconds (configurable via env)
  const intervalSec = Number(process.env.BRIDGE_POLL_SEC || 5);
  setInterval(readAndSendData, Math.max(1, intervalSec) * 1000);
}

start();

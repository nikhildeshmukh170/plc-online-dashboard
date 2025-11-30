// bridge.js

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const ModbusRTU = require('modbus-serial');

// ===================== CONFIGURATION ===================== //

const config = {
  // API endpoint (your cloud/local backend where data will be stored)
  apiUrl:
    process.env.CLOUD_API_URL ||
    process.env.CLOUD_UPDATE_URL ||
    'http://localhost:5000/api/plc/update',

  // PLC Modbus TCP connection
  plcHost: process.env.PLC_IP || '192.168.0.10',
  plcPort: parseInt(process.env.PLC_PORT || '502', 10),

  // Polling interval (seconds → ms)
  pollInterval: parseInt(process.env.BRIDGE_POLL_SEC || '5', 10) * 1000,

  // Demo mode (true: no PLC, generate fake data)
  demoMode: process.env.DEMO !== 'false'
};

// Canonical update URL
let CLOUD_UPDATE_URL = config.apiUrl;
try {
  const u = new URL(config.apiUrl);
  CLOUD_UPDATE_URL = `${u.origin}/api/plc/update`;
} catch (e) {
  CLOUD_UPDATE_URL = config.apiUrl;
}

// ========== DEFAULT DYNAMIC TAG CONFIG (can be overridden by API) ========== //
// This should match what the user configures from frontend (plc_tags table):
//   tag:    logical name (e.g. "Temperature-01")
//   address: Modbus register/coil address (integer)
//   type:   "boolean" | "uint16" | "int16" | "float"
//   function: "holding" | "input" | "coil" | "discrete"
let TAG_CONFIG = [
  // Analog examples
  { tag: 'WFI-TST-01', address: 0, type: 'float', function: 'holding', unit: '°C' },
  { tag: 'WFI-TST-02', address: 2, type: 'float', function: 'holding', unit: '°C' },
  { tag: 'PRESSURE-01', address: 4, type: 'float', function: 'holding', unit: 'bar' },

  // Integer example
  { tag: 'LEVEL-01', address: 10, type: 'uint16', function: 'input', unit: '%' },

  // Digital / boolean examples
  { tag: 'RUNNING', address: 0, type: 'boolean', function: 'coil' },
  { tag: 'STERILIZATION', address: 1, type: 'boolean', function: 'coil' }
];

// Helper to calculate / rebuild TAG_CONFIG into indexes when tags are loaded
function normalizeTagConfig(arr) {
  return arr
    .filter(t => t && t.tag && t.address !== undefined && t.type && t.function)
    .map(t => ({ tag: t.tag, address: Number(t.address), type: t.type, function: t.function, label: t.label || null, unit: t.unit || null }));
}

// ===================== DEMO SIMULATOR (optional) ===================== //

class PLCSimulator {
  constructor(tagConfig = TAG_CONFIG) {
    this.tagConfig = normalizeTagConfig(tagConfig);
    this.values = {};
    this.trends = {};
    this.initialize();
  }

  initialize() {
    this.tagConfig.forEach(cfg => {
      if (cfg.type === 'boolean') {
        this.values[cfg.tag] = Math.random() > 0.5;
      } else if (cfg.type === 'float') {
        // Random value between 20 and 90 as example
        this.values[cfg.tag] = 20 + Math.random() * 70;
      } else {
        this.values[cfg.tag] = Math.floor(Math.random() * 100);
      }
      // initialize trends for smooth fluctuation
      if (!this.trends[cfg.tag]) {
        this.trends[cfg.tag] = { countdown: Math.floor(Math.random() * 20), direction: Math.random() > 0.5 ? 1 : -1, strength: Math.random() * 0.1 };
      }
    });
  }

  updateValues() {
    this.tagConfig.forEach(cfg => {
      if (cfg.type === 'boolean') {
        // flip rarely
        if (Math.random() < 0.1) {
          this.values[cfg.tag] = !this.values[cfg.tag];
        }
      } else if (cfg.type === 'float') {
        // small random drift
        const v = this.values[cfg.tag] + (Math.random() - 0.5) * 2;
        this.values[cfg.tag] = Number(v.toFixed(2));
      } else {
        let v = this.values[cfg.tag] + Math.floor((Math.random() - 0.5) * 5);
        if (v < 0) v = 0;
        this.values[cfg.tag] = v;
      }
    });

    const now = new Date();

    // This is the structure you can directly store in DB
    return {
      timestamp: now.toISOString(),      // actual date & time of reading
      tags: { ...this.values }          // { "WFI-TST-01": 34.5, "RUNNING": true, ... }
    };
  }

  // Replace existing config and reinitialize values for new tags
  setConfig(newConfig) {
    this.tagConfig = normalizeTagConfig(newConfig);
    // initialize values for any new tags, keep existing values where possible
    this.tagConfig.forEach(cfg => {
      if (this.values[cfg.tag] === undefined) {
        if (cfg.type === 'boolean') this.values[cfg.tag] = Math.random() > 0.5;
        else if (cfg.type === 'float') this.values[cfg.tag] = 20 + Math.random() * 70;
        else this.values[cfg.tag] = Math.floor(Math.random() * 100);
      }
      if (!this.trends[cfg.tag]) {
        this.trends[cfg.tag] = { countdown: Math.floor(Math.random() * 20), direction: Math.random() > 0.5 ? 1 : -1, strength: Math.random() * 0.1 };
      }
    });
  }
}

// ===================== MODBUS BRIDGE ===================== //

class PLCBridge {
  constructor() {
    this.tagConfig = TAG_CONFIG; // initial default
    this.simulator = new PLCSimulator(this.tagConfig);
    this.client = new ModbusRTU();
    this.connected = false;
    this.lastError = null;
  }

  // Fetch tag configuration from API, update local tagConfig and simulator
  async fetchRemoteTags() {
    try {
      const baseApi = CLOUD_UPDATE_URL.replace(/\/api\/plc\/update$/i, '');
      const url = `${baseApi}/api/plc/tags`;
      const res = await axios.get(url, { timeout: 5000 });
      if (Array.isArray(res.data)) {
        const newTags = normalizeTagConfig(res.data);
        if (JSON.stringify(newTags) !== JSON.stringify(this.tagConfig)) {
          console.log(`🔁 Tag config updated (${newTags.length} tags)`);
          this.tagConfig = newTags;
          TAG_CONFIG = newTags; // also update global for demo fallback
          this.simulator.setConfig(this.tagConfig);
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch remote tags:', err.response?.status || err.message);
    }
  }

  async connectToPLC() {
    if (config.demoMode) {
      console.log('ℹ️ Running in DEMO mode — skipping PLC connection.');
      return true;
    }

    try {
      await this.client.connectTCP(config.plcHost, { port: config.plcPort });
      this.client.setID(1); // Default unit ID; change if your PLC uses different
      this.connected = true;
      console.log('✅ Connected to PLC:', config.plcHost, 'port', config.plcPort);
      return true;
    } catch (err) {
      this.lastError = err;
      this.connected = false;
      console.error('❌ PLC connection failed:', err.message);
      return false;
    }
  }

  // ---- Helpers to combine Modbus words into typed values ---- //

  _readFloatFromRegisters(regs, offset) {
    // 2 registers → 32-bit float
    const buf = Buffer.alloc(4);
    // Adjust byte order as needed for your PLC (this is a common one)
    buf.writeUInt16BE(regs[offset], 0);
    buf.writeUInt16BE(regs[offset + 1], 2);
    return buf.readFloatBE(0);
  }

  _readInt16(regs, offset) {
    return (regs[offset] & 0x8000)
      ? regs[offset] - 0x10000
      : regs[offset];
  }

  _readUInt16(regs, offset) {
    return regs[offset];
  }

  // ---- Read all tags from PLC ---- //

  async readPLCData() {
    if (config.demoMode) {
      return this.simulator.updateValues();
    }

    if (!this.connected) {
      throw new Error('PLC not connected');
    }

    const now = new Date();

    // We’ll read per function type (holding, input, coils, discretes)
    const resultValues = {};

    // ========== 1. Analog from Holding Registers ==========
    const holdingTags = (this.tagConfig || TAG_CONFIG).filter(t => t.function === 'holding');
    if (holdingTags.length > 0) {
      // Determine required register range taking types into account (float=2 regs, others=1)
      const startAddr = Math.min(...holdingTags.map(t => t.address));
      const endAddr = Math.max(...holdingTags.map(t => {
        const size = (t.type === 'float') ? 2 : 1;
        return t.address + size - 1;
      }));
      const numRegs = endAddr - startAddr + 1;

      try {
        const res = await this.client.readHoldingRegisters(startAddr, numRegs);
        const regs = res.data;

        holdingTags.forEach(tagCfg => {
          const rel = tagCfg.address - startAddr;
          let value = null;
          if (tagCfg.type === 'float') {
            value = this._readFloatFromRegisters(regs, rel);
          } else if (tagCfg.type === 'int16') {
            value = this._readInt16(regs, rel);
          } else if (tagCfg.type === 'uint16') {
            value = this._readUInt16(regs, rel);
          } else {
            value = this._readUInt16(regs, rel);
          }
          resultValues[tagCfg.tag] = value;
        });
      } catch (err) {
        console.error('❌ Error reading holding registers:', err.message);
      }
    }

    // ========== 2. Analog from Input Registers ==========
    const inputTags = (this.tagConfig || TAG_CONFIG).filter(t => t.function === 'input');
    if (inputTags.length > 0) {
      const startAddr = Math.min(...inputTags.map(t => t.address));
      const endAddr = Math.max(...inputTags.map(t => {
        const size = (t.type === 'float') ? 2 : 1;
        return t.address + size - 1;
      }));
      const numRegs = endAddr - startAddr + 1;

      try {
        const res = await this.client.readInputRegisters(startAddr, numRegs);
        const regs = res.data;

        inputTags.forEach(tagCfg => {
          const rel = tagCfg.address - startAddr;
          let value = null;
          if (tagCfg.type === 'float') {
            value = this._readFloatFromRegisters(regs, rel);
          } else if (tagCfg.type === 'int16') {
            value = this._readInt16(regs, rel);
          } else if (tagCfg.type === 'uint16') {
            value = this._readUInt16(regs, rel);
          } else {
            value = this._readUInt16(regs, rel);
          }
          resultValues[tagCfg.tag] = value;
        });
      } catch (err) {
        console.error('❌ Error reading input registers:', err.message);
      }
    }

    // ========== 3. Coils (booleans) ==========
    const coilTags = (this.tagConfig || TAG_CONFIG).filter(t => t.function === 'coil');
    if (coilTags.length > 0) {
      const startAddr = Math.min(...coilTags.map(t => t.address));
      const endAddr = Math.max(...coilTags.map(t => t.address));
      const numCoils = endAddr - startAddr + 1;

      try {
        const res = await this.client.readCoils(startAddr, numCoils);
        const bits = res.data;

        coilTags.forEach(tagCfg => {
          const rel = tagCfg.address - startAddr;
          resultValues[tagCfg.tag] = !!bits[rel];
        });
      } catch (err) {
        console.error('❌ Error reading coils:', err.message);
      }
    }

    // ========== 4. Discrete Inputs (booleans) ==========
    const discTags = (this.tagConfig || TAG_CONFIG).filter(t => t.function === 'discrete');
    if (discTags.length > 0) {
      const startAddr = Math.min(...discTags.map(t => t.address));
      const endAddr = Math.max(...discTags.map(t => t.address));
      const numInputs = endAddr - startAddr + 1;

      try {
        const res = await this.client.readDiscreteInputs(startAddr, numInputs);
        const bits = res.data;

        discTags.forEach(tagCfg => {
          const rel = tagCfg.address - startAddr;
          resultValues[tagCfg.tag] = !!bits[rel];
        });
      } catch (err) {
        console.error('❌ Error reading discrete inputs:', err.message);
      }
    }

    // Final structure returned:
    return {
      timestamp: now.toISOString(),    // exact date & time
      tags: resultValues               // { tagName: value, ... }
    };
  }

  // -------------- Send to Cloud / Database API -------------- //

  /**
   * Send individual tag updates to match backend API format { tag, value }
   * payload: {
   *   timestamp: ISO string,
   *   tags: { "WFI-TST-01": 45.6, "RUNNING": true, ... }
   * }
   */
  async sendPayload(payload) {
    const { tags, timestamp } = payload;
    const tagEntries = Object.entries(tags);
    let successCount = 0;
    let failureCount = 0;

    for (const [tag, value] of tagEntries) {
      try {
        const res = await axios.post(
          CLOUD_UPDATE_URL,
          { tag, value },
          { timeout: 5000 }
        );
        console.log(`📤 ${tag}: ${value} (${res.status})`);
        successCount++;
      } catch (err) {
        const errorMsg = err.response?.status 
          ? `HTTP ${err.response.status}` 
          : err.message;
        console.error(`❌ Failed to update ${tag}: ${errorMsg}`);
        failureCount++;
      }
    }

    console.log(
      `✅ Batch update: ${successCount}/${tagEntries.length} tags sent at ${timestamp}`
    );
    
    if (failureCount > 0) {
      throw new Error(`${failureCount} tags failed to update`);
    }
    
    return { success: true, updated: successCount };
  }

  // ===================== START LOOP ===================== //

  async start() {
    console.log('\n🔄 Starting PLC bridge...');
    console.log(`Mode: ${config.demoMode ? '📊 Demo/Simulation' : '🏭 Production'}`);
    console.log(`PLC: ${config.plcHost}:${config.plcPort}`);
    console.log(`API Endpoint: ${CLOUD_UPDATE_URL}`);
    console.log(`Update Interval: ${config.pollInterval}ms`);
    console.log('\nConfigured Tags (from TAG_CONFIG):');
    this.tagConfig.forEach(cfg => {
      console.log(
        `  ${cfg.tag} → addr=${cfg.address}, type=${cfg.type}, func=${cfg.function}`
      );
    });
    console.log('');

    await this.connectToPLC();
    // Try fetching tag config first from backend for dynamic tags
    await this.fetchRemoteTags();

    // Also periodically refresh tags config every minute
    setInterval(() => this.fetchRemoteTags(), 60 * 1000);

    let errorCount = 0;
    const MAX_ERRORS = 5;

    const updateLoop = async () => {
      try {
        const data = await this.readPLCData();
        await this.sendPayload(data);
        errorCount = 0; // Reset error count on success
      } catch (err) {
        errorCount++;
        console.error(`❌ Error in update cycle (${errorCount}/${MAX_ERRORS}):`, err.message);

        if (errorCount >= MAX_ERRORS) {
          console.error('❌ Max errors reached. Exiting...');
          process.exit(1);
        }

        if (!config.demoMode && !this.connected) {
          console.log('🔄 Attempting to reconnect to PLC...');
          await this.connectToPLC();
        }
      }
    };

    // Run immediately and then on interval
    console.log('✅ Bridge started successfully\n');
    updateLoop();
    setInterval(updateLoop, config.pollInterval);

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⛔ Shutting down...');
      if (!config.demoMode && this.connected) {
        this.client.close();
      }
      process.exit(0);
    });
  }
}

// Start the bridge
const bridge = new PLCBridge();
bridge.start().catch(err => {
  console.error('Failed to start bridge:', err);
  process.exit(1);
});

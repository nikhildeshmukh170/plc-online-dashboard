import axios from "axios";
import ModbusRTU from "modbus-serial";

// ✅ Cloud API URL (Render endpoint)
const CLOUD_API_URL = "https://plc-online-dashboard.onrender.com/api/plc/update"; // 👈 match your Render API route

// ✅ PLC details
const PLC_IP = "192.168.0.10"; // Replace with actual PLC IP
const PLC_PORT = 502;

const client = new ModbusRTU();

// --- Connect to PLC ---
async function connectPLC() {
  try {
    await client.connectTCP(PLC_IP, { port: PLC_PORT });
    console.log("✅ Connected to PLC:", PLC_IP);
  } catch (error) {
    console.error("❌ PLC connection failed:", error.message);
  }
}

// --- Read from PLC and send to Cloud API ---
async function readAndSendData() {
  try {
    // Example: simulate PLC data for now (demo mode)
    // In real scenario: const data = await client.readHoldingRegisters(0, 2);
    // const plcValue = data.data[0];
    const plcValue = Math.floor(Math.random() * 100);

    // Send to cloud API
    const res = await axios.post(CLOUD_API_URL, {
      tag: "temperature",
      value: plcValue.toString(),
    });

    console.log("📤 Sent to cloud:", plcValue, "| Cloud response:", res.status);
  } catch (err) {
    console.error("⚠️ Error sending data:", err.message);
  }
}

// --- Start Process ---
async function start() {
  await connectPLC();
  console.log("🚀 Starting PLC data upload loop...");
  setInterval(readAndSendData, 5000); // every 5 seconds
}

start();

import axios from "axios";
import ModbusRTU from "modbus-serial";

// Replace with your actual Cloud API URL
const CLOUD_API_URL = "https://plc-online-dashboard.onrender.com/api/plc-upload";

const client = new ModbusRTU();
const PLC_IP = "192.168.0.10"; // Example
const PLC_PORT = 502;

// Connect to PLC
async function connectPLC() {
  try {
    await client.connectTCP(PLC_IP, { port: PLC_PORT });
    console.log("✅ Connected to PLC");
  } catch (error) {
    console.error("PLC connection failed:", error.message);
  }
}

// Read data and send to Cloud
async function readAndSendData() {
  try {
    // const data = await client.readHoldingRegisters(0, 2); // Example register read
    // const plcValue = data.data[0];
    const plcValue = Math.floor(Math.random() * 100);


    await axios.post(CLOUD_API_URL, {
      tag: "temperature",
      value: plcValue.toString(),
    });

    console.log("📤 Sent to cloud:", plcValue);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

// Loop every 5 seconds
async function start() {
  await connectPLC();
  setInterval(readAndSendData, 5000);
}

start();

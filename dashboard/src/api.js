import axios from "axios";

const API_BASE = "https://plc-cloud-api.onrender.com/api";

export const getPLCData = () => axios.get(`${API_BASE}/plc-data`);
export const updatePLCValue = (tag, value) =>
  axios.post(`${API_BASE}/update-value`, { tag, value });

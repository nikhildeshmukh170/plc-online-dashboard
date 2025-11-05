import axios from "axios";

// Default to localhost:5000 when running locally if REACT_APP_API_URL is not set.
const base = process.env.REACT_APP_API_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: base,
});
export const getPLCData = async () => {
  // cloud_api exposes GET /api/plc/data
  const res = await api.get("/api/plc/data");
  return res.data;
};

export const updatePLCValue = async (tag, value) => {
  // cloud_api exposes PUT /api/plc/edit
  const res = await api.put("/api/plc/edit", { tag, value });
  return res.data;
};

export default api;

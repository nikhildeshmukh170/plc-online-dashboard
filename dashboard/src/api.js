import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

export const getPLCData = async () => {
  const res = await api.get("/api/plc/data");
  return res.data;
};

export const updatePLCValue = async (tag, value) => {
  const res = await api.put("/api/plc/edit", { tag, value });
  return res.data;
};

export default api;

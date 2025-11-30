import axios from "axios";

// Default to localhost:5000 when running locally if REACT_APP_API_URL is not set.
const base = process.env.REACT_APP_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: base,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json"
  }
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export const getPLCData = async () => {
  try {
    const res = await api.get("/api/plc/data");
    return res.data;
  } catch (err) {
    console.error("Failed to fetch PLC data:", err.message);
    throw err;
  }
};

export const updatePLCValue = async (tag, value) => {
  try {
    const res = await api.put("/api/plc/edit", { tag, value });
    return res.data;
  } catch (err) {
    console.error(`Failed to update ${tag}:`, err.message);
    throw err;
  }
};

// Tag configuration endpoints
export const getTags = async () => {
  const res = await api.get('/api/plc/tags');
  return res.data;
};

export const createTag = async (payload) => {
  const res = await api.post('/api/plc/tags', payload);
  return res.data;
};

export const updateTag = async (id, payload) => {
  const res = await api.put(`/api/plc/tags/${id}`, payload);
  return res.data;
};

export const deleteTag = async (id) => {
  const res = await api.delete(`/api/plc/tags/${id}`);
  return res.data;
};

export const getTagHistory = async (tag, limit = 50) => {
  const res = await api.get('/api/plc/history', { params: { tag, limit } });
  return res.data;
};

export default api;

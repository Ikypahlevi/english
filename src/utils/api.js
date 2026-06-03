import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("engmaster-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

axios.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 || error.response?.status === 403) {
    localStorage.removeItem("engmaster-token");
    localStorage.removeItem("engmaster-user");
    window.dispatchEvent(new Event("auth-expired"));
  }
  return Promise.reject(error);
});

export default axios;

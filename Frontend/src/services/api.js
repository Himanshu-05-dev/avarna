import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
  withCredentials: true, // required: backend uses httpOnly cookie for JWT
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor — normalise error shape for Redux thunks
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Something went wrong";
    return Promise.reject({ message, status: error?.response?.status });
  }
);

export default api;

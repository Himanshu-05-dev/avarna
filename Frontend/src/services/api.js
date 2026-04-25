import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
  withCredentials: true, // required: backend uses httpOnly cookie for JWT
  timeout: 180_000,     // 3 min — crawl pipeline can take a while
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor — preserve the full Axios error so Redux thunks
// can read err.response.data.error / err.response.data.errorCode etc.
// We attach a convenience .message but do NOT strip the response object.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Attach a human-readable message for convenience
    error.message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Something went wrong";
    // Re-throw the original Axios error (with .response intact)
    return Promise.reject(error);
  }
);

export default api;

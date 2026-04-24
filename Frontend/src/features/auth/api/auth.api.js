/**
 * LEVEL 4 — API SERVICE
 * Raw async calls to /api/auth/* — no Redux logic here.
 */
import api from "../../../services/api";

// POST /api/auth/register
export const registerApi = (data) => api.post("/auth/register", data);

// POST /api/auth/login
export const loginApi = (data) => api.post("/auth/login", data);

// POST /api/auth/logout
export const logoutApi = () => api.post("/auth/logout");

// GET  /api/auth/Get-Me
export const getMeApi = () => api.get("/auth/Get-Me");

// POST /api/auth/verify-otp
export const verifyOtpApi = (data) => api.post("/auth/verify-otp", data);

// POST /api/auth/resend-otp
export const resendOtpApi = (data) => api.post("/auth/resend-otp", data);

// POST /api/auth/Forget-password
export const forgotPasswordApi = (data) =>
  api.post("/auth/Forget-password", data);

// POST /api/auth/reset-password
export const resetPasswordApi = (data) =>
  api.post("/auth/reset-password", data);

// POST /api/auth/setPassword
export const setPasswordApi = (data) => api.post("/auth/setPassword", data);

// GET  /api/auth/google  (redirect — not called via axios, just exported as URL)
export const GOOGLE_AUTH_URL = "http://localhost:3000/api/auth/google";

/**
 * LEVEL 2 — HOOKS
 * Encapsulate all auth dispatch logic; components call only these.
 */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  registerThunk,
  loginThunk,
  logoutThunk,
  getMeThunk,
  verifyOtpThunk,
  resendOtpThunk,
  forgotPasswordThunk,
  resetPasswordThunk,
  setPasswordThunk,
  clearError,
  selectUser,
  selectIsAuthenticated,
  selectPendingEmail,
  selectAuthLoading,
  selectAuthError,
} from "../state/auth.slice";

// ─── useRegister ──────────────────────────────────────────────────────────────
export function useRegister() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("register"));
  const error = useSelector(selectAuthError("register"));

  const register = async (formData) => {
    const result = await dispatch(registerThunk(formData));
    if (registerThunk.fulfilled.match(result)) {
      toast.success("Account created! Check your email to verify.");
      navigate("/verify-otp");
    } else {
      toast.error(result.payload || "Registration failed.");
    }
  };

  const resetError = () => dispatch(clearError("register"));

  return { register, loading, error, resetError };
}

// ─── useLogin ─────────────────────────────────────────────────────────────────
export function useLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("login"));
  const error = useSelector(selectAuthError("login"));

  const login = async (credentials) => {
    const result = await dispatch(loginThunk(credentials));
    if (loginThunk.fulfilled.match(result)) {
      await dispatch(getMeThunk()); // hydrate user object
      toast.success("Welcome back!");
      navigate("/dashboard");
    } else {
      toast.error(result.payload || "Login failed.");
    }
  };

  const resetError = () => dispatch(clearError("login"));

  return { login, loading, error, resetError };
}

// ─── useLogout ────────────────────────────────────────────────────────────────
export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("logout"));

  const logout = async () => {
    const result = await dispatch(logoutThunk());
    if (logoutThunk.fulfilled.match(result)) {
      toast.success("You have been logged out.");
      navigate("/login");
    } else {
      toast.error("Logout failed. Please try again.");
    }
  };

  return { logout, loading };
}

// ─── useGetMe ─────────────────────────────────────────────────────────────────
export function useGetMe() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const loading = useSelector(selectAuthLoading("getMe"));

  const fetchMe = () => dispatch(getMeThunk());

  return { user, isAuthenticated, loading, fetchMe };
}

// ─── useVerifyOtp ─────────────────────────────────────────────────────────────
export function useVerifyOtp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("verifyOtp"));
  const error = useSelector(selectAuthError("verifyOtp"));
  const pendingEmail = useSelector(selectPendingEmail);

  const verifyOtp = async ({ email, otp }) => {
    const result = await dispatch(verifyOtpThunk({ email, otp }));
    if (verifyOtpThunk.fulfilled.match(result)) {
      toast.success("Email verified! You can now log in.");
      navigate("/login");
    } else {
      toast.error(result.payload || "Invalid OTP.");
    }
  };

  const resetError = () => dispatch(clearError("verifyOtp"));

  return { verifyOtp, loading, error, pendingEmail, resetError };
}

// ─── useResendOtp ─────────────────────────────────────────────────────────────
export function useResendOtp() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading("resendOtp"));
  const error = useSelector(selectAuthError("resendOtp"));

  const resendOtp = async (email) => {
    const result = await dispatch(resendOtpThunk({ email }));
    if (resendOtpThunk.fulfilled.match(result)) {
      toast.success("New OTP sent to your email.");
    } else {
      toast.error(result.payload || "Failed to resend OTP.");
    }
  };

  return { resendOtp, loading, error };
}

// ─── useForgotPassword ────────────────────────────────────────────────────────
export function useForgotPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("forgotPassword"));
  const error = useSelector(selectAuthError("forgotPassword"));

  const forgotPassword = async (email) => {
    const result = await dispatch(forgotPasswordThunk({ email }));
    if (forgotPasswordThunk.fulfilled.match(result)) {
      toast.success("Reset code sent to your email.");
      navigate("/reset-password");
    } else {
      toast.error(result.payload || "Failed to send reset email.");
    }
  };

  const resetError = () => dispatch(clearError("forgotPassword"));

  return { forgotPassword, loading, error, resetError };
}

// ─── useResetPassword ─────────────────────────────────────────────────────────
export function useResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("resetPassword"));
  const error = useSelector(selectAuthError("resetPassword"));

  const resetPassword = async (data) => {
    const result = await dispatch(resetPasswordThunk(data));
    if (resetPasswordThunk.fulfilled.match(result)) {
      toast.success("Password reset! You can now log in.");
      navigate("/login");
    } else {
      toast.error(result.payload || "Failed to reset password.");
    }
  };

  const resetError = () => dispatch(clearError("resetPassword"));

  return { resetPassword, loading, error, resetError };
}

// ─── useSetPassword (Google OAuth new users) ──────────────────────────────────
export function useSetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading("setPassword"));
  const error = useSelector(selectAuthError("setPassword"));

  const setPassword = async (data) => {
    const result = await dispatch(setPasswordThunk(data));
    if (setPasswordThunk.fulfilled.match(result)) {
      toast.success("Password created! You can now log in.");
      navigate("/login");
    } else {
      toast.error(result.payload || "Failed to create password.");
    }
  };

  const resetError = () => dispatch(clearError("setPassword"));

  return { setPassword, loading, error, resetError };
}

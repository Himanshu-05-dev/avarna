/**
 * LEVEL 3 — STATE (Redux Slice + Async Thunks)
 * Owns all auth state: user, status, error, isAuthenticated
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  registerApi,
  loginApi,
  logoutApi,
  getMeApi,
  verifyOtpApi,
  resendOtpApi,
  forgotPasswordApi,
  resetPasswordApi,
  setPasswordApi,
} from "../api/auth.api";

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await registerApi(formData);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await loginApi(credentials);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const logoutThunk = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      const res = await logoutApi();
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const getMeThunk = createAsyncThunk(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await getMeApi();
      return res.data.user;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const verifyOtpThunk = createAsyncThunk(
  "auth/verifyOtp",
  async (data, { rejectWithValue }) => {
    try {
      const res = await verifyOtpApi(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const resendOtpThunk = createAsyncThunk(
  "auth/resendOtp",
  async (data, { rejectWithValue }) => {
    try {
      const res = await resendOtpApi(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const forgotPasswordThunk = createAsyncThunk(
  "auth/forgotPassword",
  async (data, { rejectWithValue }) => {
    try {
      const res = await forgotPasswordApi(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const resetPasswordThunk = createAsyncThunk(
  "auth/resetPassword",
  async (data, { rejectWithValue }) => {
    try {
      const res = await resetPasswordApi(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const setPasswordThunk = createAsyncThunk(
  "auth/setPassword",
  async (data, { rejectWithValue }) => {
    try {
      const res = await setPasswordApi(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const initialState = {
  user: null,
  isAuthenticated: localStorage.getItem("hasLoggedIn") === "true",

  // granular loading flags per operation
  loading: {
    register: false,
    login: false,
    logout: false,
    getMe: false,
    verifyOtp: false,
    resendOtp: false,
    forgotPassword: false,
    resetPassword: false,
    setPassword: false,
  },

  // granular error flags per operation
  error: {
    register: null,
    login: null,
    logout: null,
    getMe: null,
    verifyOtp: null,
    resendOtp: null,
    forgotPassword: null,
    resetPassword: null,
    setPassword: null,
  },

  // post-register OTP flow
  pendingEmail: null,   // email waiting for OTP verification
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state, action) => {
      if (action.payload) {
        state.error[action.payload] = null;
      } else {
        Object.keys(state.error).forEach((k) => (state.error[k] = null));
      }
    },
    setPendingEmail: (state, action) => {
      state.pendingEmail = action.payload;
    },
    clearPendingEmail: (state) => {
      state.pendingEmail = null;
    },
  },
  extraReducers: (builder) => {
    // ── Register ──────────────────────────────────────────────────────────
    builder
      .addCase(registerThunk.pending, (state) => {
        state.loading.register = true;
        state.error.register = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.loading.register = false;
        state.pendingEmail = action.meta.arg.email; // save email for OTP step
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.loading.register = false;
        state.error.register = action.payload;
      });

    // ── Login ─────────────────────────────────────────────────────────────
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading.login = true;
        state.error.login = null;
      })
      .addCase(loginThunk.fulfilled, (state) => {
        state.loading.login = false;
        state.isAuthenticated = true;
        localStorage.setItem("hasLoggedIn", "true");
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading.login = false;
        state.error.login = action.payload;
      });

    // ── Logout ────────────────────────────────────────────────────────────
    builder
      .addCase(logoutThunk.pending, (state) => {
        state.loading.logout = true;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.loading.logout = false;
        state.user = null;
        state.isAuthenticated = false;
        localStorage.removeItem("hasLoggedIn");
      })
      .addCase(logoutThunk.rejected, (state, action) => {
        state.loading.logout = false;
        state.error.logout = action.payload;
      });

    // ── GetMe ─────────────────────────────────────────────────────────────
    builder
      .addCase(getMeThunk.pending, (state) => {
        state.loading.getMe = true;
        state.error.getMe = null;
      })
      .addCase(getMeThunk.fulfilled, (state, action) => {
        state.loading.getMe = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        localStorage.setItem("hasLoggedIn", "true");
      })
      .addCase(getMeThunk.rejected, (state, action) => {
        state.loading.getMe = false;
        state.isAuthenticated = false;
        state.error.getMe = action.payload;
        localStorage.removeItem("hasLoggedIn");
      });

    // ── Verify OTP ────────────────────────────────────────────────────────
    builder
      .addCase(verifyOtpThunk.pending, (state) => {
        state.loading.verifyOtp = true;
        state.error.verifyOtp = null;
      })
      .addCase(verifyOtpThunk.fulfilled, (state) => {
        state.loading.verifyOtp = false;
        state.pendingEmail = null;
      })
      .addCase(verifyOtpThunk.rejected, (state, action) => {
        state.loading.verifyOtp = false;
        state.error.verifyOtp = action.payload;
      });

    // ── Resend OTP ────────────────────────────────────────────────────────
    builder
      .addCase(resendOtpThunk.pending, (state) => {
        state.loading.resendOtp = true;
        state.error.resendOtp = null;
      })
      .addCase(resendOtpThunk.fulfilled, (state) => {
        state.loading.resendOtp = false;
      })
      .addCase(resendOtpThunk.rejected, (state, action) => {
        state.loading.resendOtp = false;
        state.error.resendOtp = action.payload;
      });

    // ── Forgot Password ───────────────────────────────────────────────────
    builder
      .addCase(forgotPasswordThunk.pending, (state) => {
        state.loading.forgotPassword = true;
        state.error.forgotPassword = null;
      })
      .addCase(forgotPasswordThunk.fulfilled, (state, action) => {
        state.loading.forgotPassword = false;
        state.pendingEmail = action.meta.arg.email;
      })
      .addCase(forgotPasswordThunk.rejected, (state, action) => {
        state.loading.forgotPassword = false;
        state.error.forgotPassword = action.payload;
      });

    // ── Reset Password ────────────────────────────────────────────────────
    builder
      .addCase(resetPasswordThunk.pending, (state) => {
        state.loading.resetPassword = true;
        state.error.resetPassword = null;
      })
      .addCase(resetPasswordThunk.fulfilled, (state) => {
        state.loading.resetPassword = false;
        state.pendingEmail = null;
      })
      .addCase(resetPasswordThunk.rejected, (state, action) => {
        state.loading.resetPassword = false;
        state.error.resetPassword = action.payload;
      });

    // ── Set Password (Google users) ───────────────────────────────────────
    builder
      .addCase(setPasswordThunk.pending, (state) => {
        state.loading.setPassword = true;
        state.error.setPassword = null;
      })
      .addCase(setPasswordThunk.fulfilled, (state) => {
        state.loading.setPassword = false;
      })
      .addCase(setPasswordThunk.rejected, (state, action) => {
        state.loading.setPassword = false;
        state.error.setPassword = action.payload;
      });
  },
});

export const { clearError, setPendingEmail, clearPendingEmail } =
  authSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectPendingEmail = (state) => state.auth.pendingEmail;
export const selectAuthLoading = (op) => (state) => state.auth.loading[op];
export const selectAuthError = (op) => (state) => state.auth.error[op];

export default authSlice.reducer;

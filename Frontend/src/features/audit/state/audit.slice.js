/**
 * audit.slice.js
 *
 * Manages:
 *  - runAudit        → POST /api/crawl  (run a new audit, save to DB)
 *  - fetchHistory    → GET  /api/crawl/history  (load past audits list)
 *  - loadAuditById   → GET  /api/crawl/history/:id  (reload a past audit)
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../services/api";

// ─── Async Thunks ─────────────────────────────────────────────────────────────

/** Run a new audit for a URL */
export const runAudit = createAsyncThunk(
  "audit/runAudit",
  async (url, { rejectWithValue }) => {
    try {
      const response = await api.post("/crawl", { url });
      return response.data; // { success, reportId, auditData }
    } catch (err) {
      // Prefer the server's descriptive error message over Axios' generic one
      const serverMessage = err.response?.data?.error;
      const errorCode     = err.response?.data?.errorCode;
      return rejectWithValue({
        message: serverMessage || err.message || "Audit failed",
        errorCode: errorCode || "UNKNOWN",
      });
    }
  }
);

/** Fetch the list of past audits for the logged-in user */
export const fetchAuditHistory = createAsyncThunk(
  "audit/fetchHistory",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/crawl/history");
      return response.data.auditsList; // array of summary rows
    } catch (err) {
      return rejectWithValue(err.message || "Failed to load history");
    }
  }
);

/** Load the full auditData for a specific past report */
export const loadAuditById = createAsyncThunk(
  "audit/loadById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/crawl/history/${id}`);
      return response.data; // { reportId, auditData }
    } catch (err) {
      return rejectWithValue(err.message || "Failed to load audit");
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const auditSlice = createSlice({
  name: "audit",
  initialState: {
    /** The full structured audit JSON currently being viewed */
    auditData: null,
    /** The DB id of the currently loaded report */
    currentReportId: null,
    /** The URL that was last audited */
    lastUrl: null,

    /** run-audit lifecycle */
    status: "idle", // idle | loading | succeeded | failed
    error: null,
    errorCode: null,

    /** History list lifecycle */
    history: [],           // array of { id, target, framework, status, findings, risk, date }
    historyStatus: "idle", // idle | loading | succeeded | failed
    historyError: null,
  },

  reducers: {
    clearAudit(state) {
      state.auditData = null;
      state.currentReportId = null;
      state.lastUrl = null;
      state.status = "idle";
      state.error = null;
      state.errorCode = null;
    },
  },

  extraReducers: (builder) => {
    // ── runAudit ──────────────────────────────────────────────────────────
    builder
      .addCase(runAudit.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.errorCode = null;
        state.lastUrl = action.meta.arg;
      })
      .addCase(runAudit.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.auditData = action.payload.auditData;
        state.currentReportId = action.payload.reportId;
      })
      .addCase(runAudit.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.message || action.payload || "Audit failed";
        state.errorCode = action.payload?.errorCode || null;
      });

    // ── fetchAuditHistory ─────────────────────────────────────────────────
    builder
      .addCase(fetchAuditHistory.pending, (state) => {
        state.historyStatus = "loading";
        state.historyError = null;
      })
      .addCase(fetchAuditHistory.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.history = action.payload;
      })
      .addCase(fetchAuditHistory.rejected, (state, action) => {
        state.historyStatus = "failed";
        state.historyError = action.payload;
      });

    // ── loadAuditById ─────────────────────────────────────────────────────
    builder
      .addCase(loadAuditById.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadAuditById.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.auditData = action.payload.auditData;
        state.currentReportId = action.payload.reportId;
      })
      .addCase(loadAuditById.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const { clearAudit } = auditSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectAuditData            = (s) => s.audit.auditData;
export const selectAuditStatus          = (s) => s.audit.status;
export const selectAuditError           = (s) => s.audit.error;
export const selectAuditErrorCode       = (s) => s.audit.errorCode;
export const selectStatCards            = (s) => s.audit.auditData?.stat_cards;
export const selectAnalysisFindings     = (s) => s.audit.auditData?.analysis_findings    ?? [];
export const selectRemediationTasks     = (s) => s.audit.auditData?.remediation_tasks    ?? [];
export const selectComplianceFrameworks = (s) => s.audit.auditData?.compliance_frameworks ?? [];
export const selectAuditEntry           = (s) => s.audit.auditData?.audit_entry;
export const selectAiInsight            = (s) => s.audit.auditData?.ai_insight;
export const selectTimeline             = (s) => s.audit.auditData?.remediation_timeline ?? [];
export const selectQuickWins            = (s) => s.audit.auditData?.quick_wins           ?? [];
export const selectExecutiveSummary     = (s) => s.audit.auditData?.executive_summary    ?? "";
export const selectHistory              = (s) => s.audit.history;
export const selectHistoryStatus        = (s) => s.audit.historyStatus;

export default auditSlice.reducer;

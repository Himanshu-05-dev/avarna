/**
 * LEVEL 3 — STATE (Redux Slice)
 * Owns all AI Assistant chat state: messages, loading, knowledge base sources
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { sendChatMessage } from "./services/api.services";

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const sendMessageThunk = createAsyncThunk(
  "chat/sendMessage",
  async ({ message, history }, { rejectWithValue }) => {
    try {
      const res = await sendChatMessage({ message, history });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message || "Failed to get AI response.");
    }
  }
);

// ─── Initial State ────────────────────────────────────────────────────────────

const DEMO_MESSAGES = [
  {
    id: "msg-demo-user-1",
    role: "user",
    content:
      "Can you review the latest Access Control Policy (v2.4) and tell me if it satisfies the SOC2 CC6.1 requirement for timely revocation of credentials?",
    timestamp: "10:24 AM",
    sender: "Marcus Sterling",
  },
  {
    id: "msg-demo-ai-1",
    role: "assistant",
    timestamp: "10:25 AM",
    content:
      "Based on my analysis of the **Access Control Policy v2.4**, the requirement for SOC2 CC6.1 is partially addressed.\n\n1. Section 4.2 explicitly mandates credential revocation within 24 hours of employee termination [Ref 01].\n2. However, there is no mention of \"immediate\" revocation for high-risk terminations, which is a suggested best practice for CC6.1 [Ref 02].",
    references: [
      { label: "Ref 01", source: "Access_Control_v2.4.pdf", line: "Section 4.2" },
      { label: "Ref 02", source: "SOC2_Criteria_2017.pdf", line: "CC6.1.1" },
    ],
    citations: ["Access_Control_v2.4.pdf", "SOC2_Criteria_2017.pdf"],
  },
];

const KNOWLEDGE_SOURCES = [
  {
    id: "ks-1",
    name: "Access_Control_Policy_v2.4",
    modified: "Oct 12, 2023",
    status: "synced",
    chunks: 42,
    icon: "pdf",
    color: "rose",
  },
  {
    id: "ks-2",
    name: "SOC2_Trust_Services_2017",
    modified: "Jan 01, 2021",
    status: "synced",
    chunks: 158,
    icon: "doc",
    color: "blue",
  },
  {
    id: "ks-3",
    name: "HR_Employee_Revocation_Log",
    modified: "2h ago",
    status: "indexing",
    chunks: null,
    icon: "table",
    color: "indigo",
  },
];

const LIVE_CITATIONS = [
  {
    id: "cite-1",
    source: "Access_Control_v2.4 // Line 412",
    text: '"...revocation of logical access must occur within one business day of notice..."',
  },
  {
    id: "cite-2",
    source: "SOC2_Trust_Criteria // CC6.1.1",
    text: '"Procedures to authorize, modify, and terminate access..."',
  },
];

const initialState = {
  messages: DEMO_MESSAGES,
  isLoading: false,
  error: null,
  knowledgeSources: KNOWLEDGE_SOURCES,
  liveCitations: LIVE_CITATIONS,
  isOpen: false,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.messages = [];
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    addOptimisticMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    openAssistant: (state) => {
      state.isOpen = true;
    },
    closeAssistant: (state) => {
      state.isOpen = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.messages.push({
          id: `msg-ai-${Date.now()}`,
          role: "assistant",
          content: action.payload.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          references: action.payload.references ?? [],
          citations: action.payload.citations ?? [],
        });
        if (action.payload.citations?.length) {
          const newCitations = action.payload.citations.map((c, i) => ({
            id: `cite-live-${Date.now()}-${i}`,
            source: c,
            text: action.payload.citation_texts?.[i] ?? "",
          }));
          state.liveCitations = [...newCitations, ...state.liveCitations].slice(0, 4);
        }
      })
      .addCase(sendMessageThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        // Remove the optimistic user message if AI fails
        state.messages = state.messages.filter((m) => !m.optimistic);
      });
  },
});

export const { clearMessages, clearError, addOptimisticMessage, openAssistant, closeAssistant } = chatSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectMessages = (state) => state.chat.messages;
export const selectChatLoading = (state) => state.chat.isLoading;
export const selectChatError = (state) => state.chat.error;
export const selectKnowledgeSources = (state) => state.chat.knowledgeSources;
export const selectLiveCitations = (state) => state.chat.liveCitations;
export const selectIsAssistantOpen = (state) => state.chat.isOpen;

export default chatSlice.reducer;

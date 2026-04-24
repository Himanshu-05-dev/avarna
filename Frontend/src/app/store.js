/**
 * Redux store — add all feature slices here.
 */
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/state/auth.slice";
import auditReducer from "../features/audit/state/audit.slice";
import chatReducer from "../features/aiAssistant/chat.slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    audit: auditReducer,
    chat: chatReducer,
  },
});

export default store;

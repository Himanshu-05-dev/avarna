/**
 * LEVEL 4 — API SERVICE
 * Raw async calls for AI Audit Assistant chat
 */
import api from "../../../services/api";

/**
 * POST /api/chat/message
 * Sends a message and chat history to the AI backend
 * @param {{ message: string, history: Array<{role: string, content: string}> }} payload
 */
export const sendChatMessage = ({ message, history = [] }) =>
  api.post("/chat/message", { message, history });

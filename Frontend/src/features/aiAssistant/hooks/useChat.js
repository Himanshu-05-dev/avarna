/**
 * LEVEL 2 — HOOKS
 * Encapsulates all chat dispatch logic; components call only this.
 */
import { useDispatch, useSelector } from "react-redux";
import {
  sendMessageThunk,
  addOptimisticMessage,
  clearMessages,
  clearError,
  selectMessages,
  selectChatLoading,
  selectChatError,
  selectKnowledgeSources,
  selectLiveCitations,
} from "../chat.slice";

export function useChat() {
  const dispatch = useDispatch();

  const messages = useSelector(selectMessages);
  const isLoading = useSelector(selectChatLoading);
  const error = useSelector(selectChatError);
  const knowledgeSources = useSelector(selectKnowledgeSources);
  const liveCitations = useSelector(selectLiveCitations);

  /**
   * Send a new message. Optimistically adds the user message,
   * then dispatches the thunk for the AI reply.
   * @param {string} message
   */
  const sendMessage = async (message) => {
    if (!message.trim()) return;

    const userMsg = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: message.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sender: "You",
      optimistic: true,
    };

    // Add user message immediately (optimistic)
    dispatch(addOptimisticMessage(userMsg));

    // Build minimal history for context (last 6 messages only)
    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await dispatch(sendMessageThunk({ message: message.trim(), history }));
  };

  const resetChat = () => dispatch(clearMessages());
  const dismissError = () => dispatch(clearError());

  return {
    messages,
    isLoading,
    error,
    knowledgeSources,
    liveCitations,
    sendMessage,
    resetChat,
    dismissError,
  };
}

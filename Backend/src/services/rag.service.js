/**
 * rag.service.js
 *
 * Thin HTTP client that forwards audit-grounded questions to the Python
 * RAG microservice running on port 8001.
 *
 * The RAG service is secured with an X-API-Key header so only this
 * backend (knowing the shared secret) can call it.
 */

import { config } from '../config/config.js';

const RAG_URL     = config.RAG_URL     || 'http://localhost:8001';
const RAG_API_KEY = config.RAG_API_KEY || '';

/**
 * Send a user question + the full auditData payload to the RAG service.
 *
 * @param {string} question   - The user's natural-language question.
 * @param {object} auditData  - The AuditReport.auditData object from MongoDB.
 * @param {string} [sessionId] - Optional session ID for future chat history.
 * @returns {Promise<{answer: string, sources: object[], audit_summary: object}>}
 */
export async function queryRagWithAudit(question, auditData, sessionId = null) {
  const endpoint = `${RAG_URL}/query-with-audit`;

  const body = { question, audit_data: auditData };
  if (sessionId) body.session_id = sessionId;

  let response;
  try {
    response = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    RAG_API_KEY,
      },
      body: JSON.stringify(body),
      // Timeout after 60 s — LLM generation can take a few seconds
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    // Network-level failure (RAG service down, timeout, etc.)
    console.error('[ragService] Network error reaching RAG service:', err.message);
    throw new RagServiceError('RAG service is unreachable. Please try again later.', 503);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[ragService] RAG service returned ${response.status}:`, text);

    if (response.status === 403) {
      throw new RagServiceError('RAG API key mismatch — check RAG_API_KEY configuration.', 500);
    }
    if (response.status === 503) {
      throw new RagServiceError('RAG agent is still initialising. Try again in a moment.', 503);
    }
    throw new RagServiceError(`RAG service error: ${text || response.statusText}`, 502);
  }

  return response.json();
}

/**
 * Send a general user question to the RAG service.
 *
 * @param {string} question   - The user's natural-language question.
 * @param {Array}  [history]  - Optional chat history.
 * @returns {Promise<{answer: string, sources: object[]}>}
 */
export async function queryRagGeneral(question, history = []) {
  const endpoint = `${RAG_URL}/query`;

  const body = { question, history };

  let response;
  try {
    response = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    RAG_API_KEY,
      },
      body: JSON.stringify(body),
      // Timeout after 60 s — LLM generation can take a few seconds
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    // Network-level failure (RAG service down, timeout, etc.)
    console.error('[ragService] Network error reaching RAG service:', err.message);
    throw new RagServiceError('RAG service is unreachable. Please try again later.', 503);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[ragService] RAG service returned ${response.status}:`, text);

    if (response.status === 403) {
      throw new RagServiceError('RAG API key mismatch — check RAG_API_KEY configuration.', 500);
    }
    if (response.status === 503) {
      throw new RagServiceError('RAG agent is still initialising. Try again in a moment.', 503);
    }
    throw new RagServiceError(`RAG service error: ${text || response.statusText}`, 502);
  }

  return response.json();
}



// ─── Custom error class ───────────────────────────────────────────────────────

export class RagServiceError extends Error {
  constructor(message, httpStatus = 500) {
    super(message);
    this.name       = 'RagServiceError';
    this.httpStatus = httpStatus;
  }
}

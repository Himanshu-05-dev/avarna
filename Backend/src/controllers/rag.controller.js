/**
 * rag.controller.js
 *
 * Handles POST /api/rag/query
 *
 * Flow:
 *  1. Validate input (question + reportId).
 *  2. Fetch the AuditReport from MongoDB — enforces ownership (userId match).
 *  3. Forward question + auditData to the Python RAG service.
 *  4. Return the LLM answer to the frontend.
 */

import AuditReport from '../models/auditReport.model.js';
import { queryRagWithAudit, queryRagGeneral, RagServiceError } from '../services/rag.service.js';

export const ragQuery = async (req, res) => {
  try {
    const { question, reportId, sessionId } = req.body;
    const userId = req.user.id; // set by identifyUser middleware

    // ── Input validation ──────────────────────────────────────────────────────
    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error:   'question must be a non-empty string of at least 5 characters.',
      });
    }

    if (!reportId) {
      return res.status(400).json({
        success: false,
        error:   'reportId is required.',
      });
    }

    // ── Fetch audit from MongoDB (ownership-checked) ──────────────────────────
    const report = await AuditReport.findOne({ _id: reportId, userId }).lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        error:   'Audit report not found or access denied.',
      });
    }

    console.log(
      `[ragController] Query for report ${reportId} by user ${userId}: "${question.slice(0, 60)}…"`
    );

    // ── Call RAG service ──────────────────────────────────────────────────────
    const ragResult = await queryRagWithAudit(
      question.trim(),
      report.auditData,
      sessionId || null,
    );

    return res.status(200).json({
      success:      true,
      question:     ragResult.question,
      answer:       ragResult.answer,
      sources:      ragResult.sources,
      auditSummary: ragResult.audit_summary,
    });

  } catch (err) {
    if (err instanceof RagServiceError) {
      console.error('[ragController] RAG service error:', err.message);
      return res.status(err.httpStatus).json({ success: false, error: err.message });
    }

    console.error('[ragController] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

export const ragGeneralQuery = async (req, res) => {
  try {
    const { question, history } = req.body;
    const userId = req.user?.id; // user may be present if logged in

    // ── Input validation ──────────────────────────────────────────────────────
    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error:   'question must be a non-empty string of at least 5 characters.',
      });
    }

    console.log(
      `[ragController] General Query by user ${userId || 'anonymous'}: "${question.slice(0, 60)}…"`
    );

    // ── Call RAG service ──────────────────────────────────────────────────────
    const ragResult = await queryRagGeneral(question.trim(), history || []);

    return res.status(200).json({
      success:      true,
      question:     ragResult.question || question,
      answer:       ragResult.answer,
      sources:      ragResult.sources || [],
    });

  } catch (err) {
    if (err instanceof RagServiceError) {
      console.error('[ragController] RAG service error:', err.message);
      return res.status(err.httpStatus).json({ success: false, error: err.message });
    }

    console.error('[ragController] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

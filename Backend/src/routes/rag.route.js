import { Router } from 'express';
import { ragQuery } from '../controllers/rag.controller.js';
import { identifyUser } from '../middlewares/auth.middleware.js';

const router = Router();

// All RAG routes require a valid JWT — the user must be logged in.
router.use(identifyUser);

/**
 * POST /api/rag/query
 *
 * Body: { question: string, reportId: string, sessionId?: string }
 *
 * Fetches the user's AuditReport from MongoDB and sends it along with
 * the question to the Python RAG service for a legal-grounded answer.
 */
router.post('/rag/query', ragQuery);

export default router;

import { Router } from 'express';
import { crawlUrl, getAuditHistory, getAuditById } from '../controllers/crawl.controller.js';
import { identifyUser } from '../middlewares/auth.middleware.js';

const router = Router();

// All crawl routes require authentication
router.use(identifyUser);

router.post('/crawl',              crawlUrl);
router.get('/crawl/history',       getAuditHistory);
router.get('/crawl/history/:id',   getAuditById);

export default router;

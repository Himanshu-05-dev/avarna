import express from 'express'
import cors from 'cors'
import crawlRoutes from '../routes/crawl.route.js'
import ragRoutes from '../routes/rag.route.js'
import authRouter from '../routes/auth.routes.js'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import passport from '../config/passport.js'
import { errorHandler } from '../error/catch.error.js'

const app = express()

// CORS — allow the Vite frontend to send cookies
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parsing (required for JWT cookie auth)
app.use(cookieParser());

// Logging
app.use(morgan("dev"));

// Passport (no session — JWT only)
app.use(passport.initialize());

// Static screenshots
app.use('/screenshots', express.static('screenshots'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api', crawlRoutes);
app.use('/api', ragRoutes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
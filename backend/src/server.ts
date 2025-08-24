import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Routes
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import syncRoutes from './routes/sync';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

// Prisma
const prisma = new PrismaClient();

// --- Middleware ---
/**
 * CORS:
 * - If CORS_ORIGIN is set (comma-separated list), restrict to those origins.
 * - Otherwise, allow all (useful during early integration).
 */
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin && corsOrigin.trim().length > 0) {
  const origins = corsOrigin.split(',').map(s => s.trim());
  app.use(cors({ origin: origins }));
} else {
  app.use(cors());
}

app.use(express.json());

// Optionally trust proxy if behind Vercel/Render/Railway
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// --- Routes ---
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/sync', syncRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '1.0.0',
    status: 'running',
  });
});

// --- Error handler ---
/* eslint-disable @typescript-eslint/no-unused-vars */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err?.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});
/* eslint-enable @typescript-eslint/no-unused-vars */

// --- Start server ---
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📊 E-commerce Analytics API ready');
});

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  try {
    console.log(`\nReceived ${signal}. Closing server...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    });
  } catch (e) {
    console.error('Error during shutdown:', e);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;

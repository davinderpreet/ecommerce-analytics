import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import analyticsRoutes from '../src/routes/analytics';
import healthRoutes from '../src/routes/health';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'E-commerce Analytics API',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;

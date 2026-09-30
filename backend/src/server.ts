import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaClient } from '@prisma/client';

import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth'; 
import { emailQueue, redisConnection } from './queues/emailWorker';
import { emailRouter } from './routes/email';
import slackRouter from './routes/slack';
import { initElasticsearch } from './services/elasticsearchService';

const app = express();
const prisma = new PrismaClient();

// 1. CORS Configuration (MUST allow credentials for cookies)
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://reach-in-box-ntdd-mpc3avn56-prabhat-dae9.vercel.app', // Add your exact Vercel URL here
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// 2. Better Auth Route (MUST use standard wildcard "*")
app.use('/api/auth', toNodeHandler(auth));
// 3. Body Parsers (MUST come AFTER Better Auth handler)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Health Check Endpoints
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Email Dispatcher API Service Running' });
});

app.get('/health', async (_req: Request, res: Response): Promise<any> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redisConnection.ping();
    return res.status(200).json({ status: 'ok', database: 'connected', redis: 'connected' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// 5. BullMQ Live Queue Dashboard UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// 6. Express Email API Routes
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await initElasticsearch();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`📊 Queue Dashboard live at http://localhost:${PORT}/admin/queues`);
  });

  // Graceful Shutdown Handler
  const shutdown = async () => {
    console.log('Shutting down backend server...');
    server.close(async () => {
      await prisma.$disconnect();
      await redisConnection.quit();
      console.log('Server shut down cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
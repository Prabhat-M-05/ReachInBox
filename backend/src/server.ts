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

// Allowed origins list (reads process.env.FRONTEND_URL dynamically)
const staticAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

// 1. Dynamic CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser or same-origin requests
      if (!origin) return callback(null, true);

      // Check exact match OR match any Vercel preview/production URL
      const isAllowed =
        staticAllowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy blocked request from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// 2. Better Auth Catch-All Handler (MUST come before express.json body parser)
app.all('/api/auth', toNodeHandler(auth));

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
  // Safe initialization of non-critical services
  try {
    await initElasticsearch();
    console.log('✅ Elasticsearch initialized');
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch connection failed, starting server without ES:', error.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    console.log(`📊 Queue Dashboard live at /admin/queues`);
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
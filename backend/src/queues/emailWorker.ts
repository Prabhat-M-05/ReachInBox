import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient, EmailStatus } from '@prisma/client';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import axios from 'axios';
import { indexEmailInElasticsearch } from '../services/elasticsearchService';

const prisma = new PrismaClient();

export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-dispatch-queue', { connection: redisConnection });

// Helper to notify Slack when limit is reached
async function notifySlackRateLimit(userId: string, senderEmail: string) {
  try {
    const lockKey = `slack-alert-cooldown:${userId}`;
    const acquiredLock = await redisConnection.set(lockKey, 'locked', 'EX', 3600, 'NX');
    if (!acquiredLock) return; // Cooldown active

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Check both Prisma user fields and fallback .env SLACK_WEBHOOK_URL
    const slackWebhookUrl = (user as any)?.slackWebhookURL || (user as any)?.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL;
    const slackToken = user?.slackToken;

    if (!user || (!slackToken && !slackWebhookUrl)) return;

    const message = `⚠️ *Rate Limit Reached*: Email sender \`${senderEmail}\` hit its hourly rate limit. Remaining emails will be re-scheduled automatically.`;

    if (slackWebhookUrl) {
      await axios.post(slackWebhookUrl, { text: message });
    } else if (slackToken && user?.slackChannelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel: user.slackChannelId, text: message },
        { headers: { Authorization: `Bearer ${slackToken}` } }
      );
    }
  } catch (err) {
    console.error('Failed to dispatch Slack alert:', err);
  }
}

export const emailWorker = new Worker(
  'email-dispatch-queue',
  async (job: Job) => {
    const { scheduledEmailId, senderId, userId, recipientEmail, subject, body } = job.data;

    // 1. Check DB Idempotency
    const emailRecord = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledEmailId },
      include: { sender: true },
    });

    if (!emailRecord || emailRecord.status === EmailStatus.SENT) {
      console.log(`[Job ${job.id}] Skipping — record already processed or missing.`);
      return;
    }

    const sender = emailRecord.sender;
    const currentHourKey = `rate-limit:${senderId}:${new Date().toISOString().slice(0, 13)}`;

    // 2. Atomic Rate-Limit Counter Check in Redis
    const currentCount = await redisConnection.incr(currentHourKey);
    if (currentCount === 1) {
      await redisConnection.expire(currentHourKey, 3600);
    }

    if (sender && currentCount > sender.maxEmailsPerHour) {
      // Rollback Redis counter & reschedule
      await redisConnection.decr(currentHourKey);

      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: { status: EmailStatus.RATE_LIMITED },
      });

      // Alert via Slack
      await notifySlackRateLimit(userId, sender.fromEmail);

      // Re-queue job for the next hour window
      const ttl = await redisConnection.ttl(currentHourKey);
      const reQueueDelay = (ttl > 0 ? ttl : 3600) * 1000;

      await emailQueue.add('dispatch-email', job.data, {
        delay: reQueueDelay,
        jobId: `${scheduledEmailId}-retry-${Date.now()}`,
      });

      try {
        await indexEmailInElasticsearch({
          id: emailRecord.id,
          userId,
          senderId,
          campaignId: emailRecord.campaignId || '',
          recipientEmail,
          subject,
          body,
          status: EmailStatus.RATE_LIMITED,
          scheduledAt: emailRecord.scheduledAt,
        });
      } catch (esErr: any) {
        console.warn('⚠️️ ES index update skipped for rate-limited status');
      }

      return;
    }

    // 3. Mark as PROCESSING in DB
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: { status: EmailStatus.PROCESSING },
    });

    // 4. Configure SMTP Transporter
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || 'courtney.hermiston79@ethereal.email';
    const pass = process.env.SMTP_PASS || '6mbYqxhH4wPqtHBv4X';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });

    try {
      const info = await transporter.sendMail({
        from: sender?.fromEmail || `"ReachInbox" <${process.env.SMTP_USER || 'no-reply@ethereal.email'}>`,
        to: recipientEmail,
        subject,
        html: body,
      });

      const sentAt = new Date();
      const previewUrl = nodemailer.getTestMessageUrl(info);

      console.log(`\n==================================================`);
      console.log(`✅ Email sent successfully to: ${recipientEmail}`);
      if (previewUrl) {
        console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
      }
      console.log(`==================================================\n`);

      // 5. Update DB Status to SENT
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: { status: EmailStatus.SENT, sentAt },
      });

      // 6. Update Elasticsearch safely
      try {
        await indexEmailInElasticsearch({
          id: emailRecord.id,
          userId,
          senderId,
          campaignId: emailRecord.campaignId || '',
          recipientEmail,
          subject,
          body,
          status: EmailStatus.SENT,
          scheduledAt: emailRecord.scheduledAt,
          sentAt,
        });
      } catch (esErr: any) {
        console.warn('⚠️ ES index update skipped for SENT status');
      }
    } catch (sendError: any) {
      console.error(`❌ [Job ${job.id}] Sending failed:`, sendError.message || sendError);

      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: sendError.message,
        },
      });

      try {
        await indexEmailInElasticsearch({
          id: emailRecord.id,
          userId,
          senderId,
          campaignId: emailRecord.campaignId || '',
          recipientEmail,
          subject,
          body,
          status: EmailStatus.FAILED,
          scheduledAt: emailRecord.scheduledAt,
        });
      } catch (esErr: any) {
        console.warn('⚠️ ES index update skipped for FAILED status');
      }
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

// Event Listeners keep process active & report status
emailWorker.on('ready', () => {
  console.log('🚀 Email Worker initialized successfully.');
  console.log('📡 Connected to Redis. Listening for incoming email dispatch jobs...');
});

emailWorker.on('completed', (job) => {
  console.log(`[Job ${job.id}] Successfully processed and completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Job ${job?.id}] Execution failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('❌ BullMQ Worker encountered an error:', err);
});

// Graceful process exit
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down Email Worker...');
  await emailWorker.close();
  await redisConnection.quit();
  process.exit(0);
});
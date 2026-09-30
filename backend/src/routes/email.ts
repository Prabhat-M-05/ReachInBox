import { Router, Request, Response } from 'express';
import { PrismaClient, EmailStatus } from '@prisma/client';
import { emailQueue } from '../queues/emailWorker';
import {
  indexEmailInElasticsearch,
  searchEmails,
} from '../services/elasticsearchService';
import axios from 'axios';

const prisma = new PrismaClient();
export const emailRouter = Router();

// 1. Schedule Emails Campaign API
emailRouter.post('/schedule', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      userId,
      senderId = 'sender_123',
      recipientEmail,
      recipients: incomingRecipients,
      subject,
      body,
      startTime,
      delayBetweenMs = 2000,
      maxEmailsPerHour,
    } = req.body;

    // Normalizing recipient emails into a single array (supports array or single recipientEmail string)
    const recipients: string[] = Array.isArray(incomingRecipients) && incomingRecipients.length > 0
      ? incomingRecipients
      : (recipientEmail ? [recipientEmail] : []);

    if (!userId || recipients.length === 0 || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields: userId, subject, body, and recipientEmail/recipients are required.',
      });
    }

    // 1. Ensure User exists or auto-create fallback user to prevent P2003 foreign key error
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`User "${userId}" not found. Creating fallback test user record...`);
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `user_${userId.slice(0, 8)}@reachinbox.com`,
          name: 'Default ReachInbox User',
        },
      });
    }

    // 2. Ensure EmailSender exists or auto-create fallback sender
    let sender = await prisma.emailSender.findUnique({ where: { id: senderId } });
    if (!sender) {
      sender = await prisma.emailSender.create({
        data: {
          id: senderId,
          userId,
          fromEmail: `sender_${senderId}@reachinbox.com`,
          smtpHost: process.env.SMTP_HOST || 'smtp.ethereal.email',
          smtpPort: Number(process.env.SMTP_PORT) || 587,
          smtpUser: process.env.SMTP_USER || 'test_user',
          smtpPass: process.env.SMTP_PASS || 'test_pass',
          maxEmailsPerHour: maxEmailsPerHour || 100,
        },
      });
    } else if (maxEmailsPerHour) {
      await prisma.emailSender.update({
        where: { id: senderId },
        data: { maxEmailsPerHour },
      });
    }

    // 3. Create Email Campaign Record
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        subject,
        body,
        delayBetweenMs,
      },
    });

    const startTimestamp = new Date(startTime || Date.now()).getTime();
    const createdEmails = [];

    // 4. Loop through recipients and queue scheduled emails
    for (let i = 0; i < recipients.length; i++) {
      const currentRecipientEmail = recipients[i];
      const calculatedDelay = Math.max(0, startTimestamp - Date.now()) + i * delayBetweenMs;
      const scheduledAt = new Date(Date.now() + calculatedDelay);

      // Save in DB first
      const scheduledEmail = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          senderId,
          recipientEmail: currentRecipientEmail,
          subject,
          body,
          scheduledAt,
          status: EmailStatus.SCHEDULED,
        },
      });

      // Index initial status in Elasticsearch safely without blocking queue addition on ES downtime
      try {
        await indexEmailInElasticsearch({
          id: scheduledEmail.id,
          userId,
          senderId,
          campaignId: campaign.id,
          recipientEmail: currentRecipientEmail,
          subject,
          body,
          status: EmailStatus.SCHEDULED,
          scheduledAt,
        });
      } catch (esError: any) {
        console.warn('⚠️ Elasticsearch indexing skipped/failed:', esError.message || esError);
      }

      // Enqueue job in BullMQ with persistent jobId matching DB record
      const job = await emailQueue.add(
        'dispatch-email',
        {
          scheduledEmailId: scheduledEmail.id,
          senderId,
          userId,
          recipientEmail: currentRecipientEmail,
          subject,
          body,
          delayBetweenMs,
        },
        {
          delay: calculatedDelay,
          jobId: scheduledEmail.id,
          removeOnComplete: true,
        }
      );

      // Link BullMQ Job ID back to Prisma record
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmail.id },
        data: { jobId: job.id },
      });

      createdEmails.push(scheduledEmail);
    }

    console.log(`✅ Successfully scheduled ${createdEmails.length} email(s) for Campaign ${campaign.id}`);

    return res.status(201).json({
      success: true,
      campaignId: campaign.id,
      count: createdEmails.length,
      data: createdEmails,
    });
  } catch (error: any) {
    console.error('❌ Error scheduling email campaign:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while scheduling email.' });
  }
});

// 2. Fetch Scheduled Emails from Database
emailRouter.get('/scheduled', async (req: Request, res: Response): Promise<any> => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: { userId },
        status: { in: [EmailStatus.SCHEDULED, EmailStatus.RATE_LIMITED, EmailStatus.PROCESSING] },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json({ data: emails });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Fetch Sent & Failed Emails from Database
emailRouter.get('/sent', async (req: Request, res: Response): Promise<any> => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: { userId },
        status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
      },
      orderBy: { sentAt: 'desc' },
    });
    return res.json({ data: emails });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Search API using Elasticsearch (Fallback to Prisma DB if ES fails)
emailRouter.get('/search', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, query, status, senderId, page, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }

    // Attempt Elasticsearch query first
    try {
      const results = await searchEmails({
        userId: userId as string,
        query: query as string,
        status: status as string,
        senderId: senderId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      return res.json(results);
    } catch (esError: any) {
      console.warn('⚠️ Search fallback: Elasticsearch unavailable. Querying Postgres database directly.');

      // Fallback query directly against Prisma Database
      const whereClause: any = { campaign: { userId: userId as string } };
      if (status) whereClause.status = status as EmailStatus;
      if (senderId) whereClause.senderId = senderId as string;
      if (query) {
        whereClause.OR = [
          { recipientEmail: { contains: query as string, mode: 'insensitive' } },
          { subject: { contains: query as string, mode: 'insensitive' } },
          { body: { contains: query as string, mode: 'insensitive' } },
        ];
      }

      const p = page ? parseInt(page as string, 10) : 1;
      const l = limit ? parseInt(limit as string, 10) : 10;

      const [total, data] = await Promise.all([
        prisma.scheduledEmail.count({ where: whereClause }),
        prisma.scheduledEmail.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * l,
          take: l,
        }),
      ]);

      return res.json({
        data,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      });
    }
  } catch (error: any) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Slack OAuth Callback Handler
emailRouter.get('/slack/callback', async (req: Request, res: Response): Promise<any> => {
  const { code, state: userId } = req.query;

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      },
    });

    if (!response.data.ok) throw new Error(response.data.error);

    const slackToken = response.data.access_token;
    const slackChannelId = response.data.incoming_webhook?.channel_id || response.data.authed_user?.id;

    await prisma.user.update({
      where: { id: userId as string },
      data: { slackToken, slackChannelId },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error('Slack OAuth error:', err);
    return res.status(500).send('Slack authorization failed.');
  }
});
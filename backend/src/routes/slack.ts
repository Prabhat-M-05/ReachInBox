// src/routes/slack.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/slack/status - Report whether the current user has connected Slack
router.get('/status', async (req: Request, res: Response): Promise<any> => {
  const userId = req.query.userId;
  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackToken: true, slackWebhookUrl: true },
    });
    return res.json({ isConnected: Boolean(user?.slackToken || user?.slackWebhookUrl) });
  } catch (error) {
    console.error('Slack status error:', error);
    return res.status(500).json({ error: 'Failed to check Slack connection' });
  }
});

// GET /api/slack/auth - Redirect user to Slack authorization page
router.get('/auth', (req: Request, res: Response) => {
  const userId = req.query.userId;
  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId || '',
    scope: 'chat:write,incoming-webhook,commands',
    redirect_uri: process.env.SLACK_REDIRECT_URI || '',
    state: userId,
  }).toString();
  return res.redirect(authorizeUrl.toString());
});

// GET /api/slack/callback - Handle OAuth redirect from Slack
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state: userId } = req.query;

  if (typeof code !== 'string' || !code || typeof userId !== 'string' || !userId) {
    return res.status(400).json({ error: 'Missing code or user state parameter' });
  }

  try {
    // Exchange temporary code for access token
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      null,
      {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: process.env.SLACK_REDIRECT_URI,
        },
      }
    );

    const data = response.data;

    if (!data.ok) {
      return res.status(400).json({ error: data.error || 'Slack OAuth failed' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackToken: data.access_token,
        slackChannelId: data.incoming_webhook?.channel_id || data.authed_user?.id,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/?slack=connected`);
  } catch (error) {
    console.error('Slack OAuth Error:', error);
    return res.status(500).json({ error: 'Internal server error during Slack auth' });
  }
});

// POST /api/slack/notify - Send direct message to a channel
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { channel, message, botToken } = req.body;

    if (!channel || !message) {
      return res.status(400).json({ error: 'Channel and message are required' });
    }

    const token = botToken || process.env.SLACK_BOT_TOKEN;

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.ok) {
      return res.status(400).json({ error: response.data.error });
    }

    return res.json({ message: 'Notification sent to Slack', data: response.data });
  } catch (error) {
    console.error('Slack Notify Error:', error);
    return res.status(500).json({ error: 'Failed to send Slack notification' });
  }
});

export default router;
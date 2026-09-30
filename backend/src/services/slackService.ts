import axios from 'axios';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface RateLimitAlertParams {
  scheduledEmailId: string;
  recipientEmail: string;
  subject: string;
  reason: string;
  senderId?: string;
}

export const sendSlackRateLimitAlert = async (params: RateLimitAlertParams) => {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('⚠️ SLACK_WEBHOOK_URL is not set in environment variables. Skipping Slack alert.');
    return;
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Email Dispatch Rate Limited',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Recipient:*\n${params.recipientEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n\`RATE_LIMITED\``,
          },
          {
            type: 'mrkdwn',
            text: `*Subject:*\n${params.subject}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email ID:*\n\`${params.scheduledEmailId}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reason / Error Details:*\n>${params.reason}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⏰ Alert triggered at: *${new Date().toISOString()}*`,
          },
        ],
      },
    ],
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, payload);
    console.log(`✅ Slack alert dispatched for email ID: ${params.scheduledEmailId}`);
  } catch (error) {
    console.error('❌ Failed to post alert to Slack Webhook:', error);
  }
};
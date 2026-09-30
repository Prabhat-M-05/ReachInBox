import { PrismaClient, EmailStatus } from '@prisma/client';
import { emailQueue } from '../queues/emailWorker';

const prisma = new PrismaClient();

export async function hydrateQueueOnStartup() {
  console.log('🔄 Checking database for un-sent jobs to re-hydrate...');

  const pendingEmails = await prisma.scheduledEmail.findMany({
    where: {
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.RATE_LIMITED] },
    },
  });

  let rehydratedCount = 0;

  for (const email of pendingEmails) {
    // Check if job is already present in BullMQ
    const existingJob = await emailQueue.getJob(email.id);
    
    if (!existingJob) {
      // Fixed: changed scheduledFor to scheduledAt
      const delay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now());

      await emailQueue.add(
        'dispatch-email',
        {
          scheduledEmailId: email.id,
          senderId: email.senderId,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          delayBetweenMs: 0,
        },
        {
          delay,
          jobId: email.id, // Enforces idempotency key
          removeOnComplete: true,
        }
      );
      rehydratedCount++;
    }
  }

  console.log(`✅ Queue hydration complete. Re-enqueued ${rehydratedCount} jobs.`);
}
import { PrismaClient } from '@prisma/client';
import { indexEmailInElasticsearch } from './services/elasticsearchService';

const prisma = new PrismaClient();

async function syncAllToElastic() {
  console.log("🔄 Syncing all emails from DB to Elasticsearch...");
  
  const emails = await prisma.scheduledEmail.findMany({
    include: { campaign: true },
  });

  let syncedCount = 0;

  for (const email of emails) {
    // Fallback to email.userId if campaign relation is null
    const userId = email.campaign?.userId || (email as any).userId || "096393fd-7a6f-4910-ac5f-513e2340b470";

    await indexEmailInElasticsearch({
      id: email.id,
      userId,
      senderId: email.senderId,
      campaignId: email.campaignId,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt || undefined,
    });
    syncedCount++;
  }

  console.log(`✅ Successfully synced ${syncedCount} emails to Elasticsearch!`);
}

syncAllToElastic()
  .catch((err) => {
    console.error("❌ Sync error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
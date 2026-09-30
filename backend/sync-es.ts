import { PrismaClient } from '@prisma/client';
import { indexEmailInElasticsearch, initElasticsearch } from './src/services/elasticsearchService';

const prisma = new PrismaClient();

async function run() {
  await initElasticsearch();
  const emails = await prisma.scheduledEmail.findMany();
  console.log(`Found ${emails.length} emails in MySQL database.`);

  for (const email of emails) {
    await indexEmailInElasticsearch({
      id: email.id,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: email.status,
      senderId: email.senderId || undefined,
      sentAt: email.sentAt || new Date(),
    });
  }

  console.log('✅ Backfill complete! All emails indexed into Elasticsearch.');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
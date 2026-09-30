import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.emailSender.updateMany({
    data: {
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'yyo5wenfk4vxcbks@ethereal.email',
      smtpPass: 'JgqahuZRsrkCAHSWF9',
      fromEmail: 'yyo5wenfk4vxcbks@ethereal.email',
    },
  });

  console.log(`Updated ${updated.count} sender record(s) with Ethereal credentials.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
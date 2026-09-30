const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  const user = await prisma.user.upsert({
    where: { id: "user_123" },
    update: {},
    create: {
      id: "user_123",
      email: "admin@reachinbox.com",
      name: "Test Admin",
      googleId: "google_123"
    }
  });

  const sender = await prisma.emailSender.upsert({
    where: { id: "sender_123" },
    update: { maxEmailsPerHour: 2 },
    create: {
      id: "sender_123",
      userId: "user_123",
      fromEmail: "test@reachinbox.com",
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUser: "test",
      smtpPass: "test",
      maxEmailsPerHour: 2
    }
  });

  console.log("✅ DATABASE SEEDED SUCCESSFULLY!");
  console.log("User created:", user.id);
  console.log("Sender created:", sender.id);
}

seed()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Creating real Ethereal SMTP test account...");
  const testAccount = await nodemailer.createTestAccount();

  console.log("📧 Ethereal User:", testAccount.user);

  // 1. Upsert User by unique email
  const user = await prisma.user.upsert({
    where: { email: "admin@reachinbox.com" },
    update: {
      name: "Test Admin",
    },
    create: {
      id: "user_123",
      email: "admin@reachinbox.com",
      name: "Test Admin",
      googleId: "google_123"
    }
  });

  // 2. Upsert Sender attached to the resolved user ID
  const sender = await prisma.emailSender.upsert({
    where: { id: "sender_123" },
    update: {
      userId: user.id,
      fromEmail: testAccount.user,
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      maxEmailsPerHour: 10
    },
    create: {
      id: "sender_123",
      userId: user.id,
      fromEmail: testAccount.user,
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      maxEmailsPerHour: 10
    }
  });

  console.log("✅ SEEDED SUCCESSFULLY WITH VALID SMTP CREDENTIALS!");
  console.log("User ID:", user.id);
  console.log("Sender ID:", sender.id);
  console.log("From Email:", sender.fromEmail);
}

seed()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

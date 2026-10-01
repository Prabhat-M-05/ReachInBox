import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  
  // Allow all active Vercel preview links & localhost
  trustedOrigins: [
    "http://localhost:3000",
    "https://reach-in-box-ntdd-abb2fp5do-prabhat-dae9.vercel.app", // Your current active Vercel link
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),

  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
});
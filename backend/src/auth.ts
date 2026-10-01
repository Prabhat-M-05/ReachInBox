import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  
  // Dynamic frontend origins + fallbacks for Vercel & local dev
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://reach-in-box-ntdd-3udgpuwj0-prabhat-dae9.vercel.app",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),
  
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
  
  onAPIError: {
    onError(error) {
      // Always log errors so you can diagnose issues in Render logs
      console.error('[Better Auth API Error]', error instanceof Error ? error.message : error);
    },
  },
});
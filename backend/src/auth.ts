import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  
  // Hardcoded origins for both Production (Vercel) and Local Development
  trustedOrigins: [
    "https://reach-in-box-ntdd-3udgpuwj0-prabhat-dae9.vercel.app", 
    "http://localhost:3000"
  ],
  
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
  onAPIError: {
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Better Auth API error]', error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error);
      }
    },
  },
});
// backend/src/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql", // or "postgresql"
  }),
  baseURL: "http://localhost:4000", // Express server URL
  trustedOrigins: ["http://localhost:3000"], // Next.js app URL
  advanced: {
    useSecureCookies: false, // Disables HTTPS cookie requirement for localhost
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
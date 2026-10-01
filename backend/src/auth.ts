import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "https://reachinbox-backend-tgzt.onrender.com",
  
  // Dynamically trust localhost, FRONTEND_URL, and any active Vercel domain
  trustedOrigins: (request) => {
    const origin = request?.headers?.get("origin") || request?.headers?.get("referer") || "";
    const allowed = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.FRONTEND_URL || "",
    ];
    if (origin && origin.includes("vercel.app")) {
      try {
        allowed.push(new URL(origin).origin);
      } catch (e) {
        // Ignore invalid URLs
      }
    }
    return allowed.filter(Boolean);
  },
  
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
  onAPIError: {
    onError(error) {
      console.error('[Better Auth API Error]', error instanceof Error ? error.message : error);
    },
  },
});
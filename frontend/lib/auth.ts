import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // Add your Vercel frontend link here (NO trailing slash at the end)
  trustedOrigins: ["https://reach-in-box-ntdd-3udgpuwj0-prabhat-dae9.vercel.app"], 
  
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
});
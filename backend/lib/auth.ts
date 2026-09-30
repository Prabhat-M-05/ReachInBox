import { betterAuth } from "better-auth";
import Database from "better-sqlite3"; // or your database client

export const auth = betterAuth({
  database: new Database("./database.sqlite"), // or your DB adapter
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  
  // This is what fixes the 403 Invalid Origin error:
  trustedOrigins: [
    "http://localhost:3000",
    "https://reach-in-box-ntdd-i8r7admio-prabhat-dae9.vercel.app"
  ],
  
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    },
  },
});
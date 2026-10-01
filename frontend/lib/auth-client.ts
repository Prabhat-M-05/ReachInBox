// frontend/lib/auth-client.ts
'use client';

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://reachinbox-backend-tgzt.onrender.com",
 // Leaves it relative so Next.js rewrites handle routing
  fetchOptions: {
    credentials: "include",
  },
});
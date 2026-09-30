// frontend/lib/auth-client.ts
'use client';

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "", // Leaves it relative so Next.js rewrites handle routing
  fetchOptions: {
    credentials: "include",
  },
});
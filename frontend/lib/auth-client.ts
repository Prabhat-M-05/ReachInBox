// frontend/lib/auth-client.ts
'use client';

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:4000", // Force port 4000 (Express)
  fetchOptions: {
    credentials: "include",
  },
});
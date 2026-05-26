import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Map unprefixed env vars (e.g. from Replit's Supabase integration)
  // to the NEXT_PUBLIC_ versions Next.js needs for client-side access.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '',
  },
};

export default nextConfig;

import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables safely in Vite or Next.js/Node environments
const getEnv = (key: string) => {
  // Check for Vite's import.meta.env
  // Casting to any to avoid TS errors when Vite types are not explicitly loaded
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  // Check for Node/Next.js process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

// Use provided credentials as fallback if env vars are missing
const DEFAULT_URL = 'https://rmirkhebjgvsqqenszts.supabase.co';
const DEFAULT_KEY = 'sb_publishable_h9bKTMYVO5RvO5eBQZTsNQ_zyZBQCc3';

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL') || DEFAULT_URL;
const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY') || DEFAULT_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("⚠️ Supabase credentials missing. Please check your configuration.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
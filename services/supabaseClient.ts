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

// Prioritizes Vercel Integration keys (SUPABASE_URL) then Vite keys (VITE_) then Next.js (NEXT_PUBLIC_)
const SUPABASE_URL = 
  getEnv('VITE_SUPABASE_URL') || 
  getEnv('NEXT_PUBLIC_SUPABASE_URL') || 
  getEnv('SUPABASE_URL');

const SUPABASE_KEY = 
  getEnv('VITE_SUPABASE_KEY') || 
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("⚠️ Supabase credentials missing. Please check your Vercel Environment Variables.");
}

// Create client only if keys exist, otherwise it might throw or create an invalid client
export const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');
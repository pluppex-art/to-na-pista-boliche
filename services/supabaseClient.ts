
import { createClient } from '@supabase/supabase-js';

// Helper seguro para pegar variáveis de ambiente no Vite ou Vercel
const getEnv = (key: string) => {
  // 1. Tenta Vite (import.meta.env)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // 2. Tenta Process (Node/Vercel Serverless) - Verifica se process existe antes de acessar
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignora erro de referência
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

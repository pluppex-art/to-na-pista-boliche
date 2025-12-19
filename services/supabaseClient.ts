
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

// Projeto ID: rmirkhebjgvsqqenszts (Conforme seu print)
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://rmirkhebjgvsqqenszts.supabase.co';
const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY') || 'sb_publishable_h9bKTMYVO5RvO5eBQZTsNQ_zyZBQCc3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

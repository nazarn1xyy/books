import { createClient } from '@supabase/supabase-js';

// User explicitly provided these keys and requested no .env file
const SUPABASE_URL = 'https://tczvevxgyxancoaqrfkc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_a-6aAi3J3txLbN-85N5CIg_RJoW_aRk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

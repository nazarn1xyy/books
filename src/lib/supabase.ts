import { createClient } from '@supabase/supabase-js';

// User explicitly provided these keys and requested no .env file
const SUPABASE_URL = 'https://tczvevxgyxancoaqrfkc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjenZldnhneXhhbmNvYXFyZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzczMTYsImV4cCI6MjA4NDUxMzMxNn0.i0cCBhaT45fZxc98_l5WsJSaBjjA3fA89TpuPKKXHH4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let isSupabaseMock = false;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'mock_supabase_url') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Supabase] Client initialized successfully.');
  } catch (err) {
    console.warn(`[Supabase Warning] Initialization failed: ${err.message}. Running in MOCK storage mode.`);
    isSupabaseMock = true;
  }
} else {
  console.warn('[Supabase Warning] Missing SUPABASE_URL or SUPABASE_KEY. Running in MOCK storage mode.');
  isSupabaseMock = true;
}

module.exports = {
  supabase,
  isSupabaseMock
};

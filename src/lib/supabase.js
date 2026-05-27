import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://oxhcbmvoipifwtxypzmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aGNibXZvaXBpZnd0eHlwem1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU1NDEsImV4cCI6MjA5NTMxMTU0MX0.W46VjGkhBSNMpKtqGZ60qK4_uI339qyhycBeERjj4Tc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

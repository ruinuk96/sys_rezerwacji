import { createClient } from '@supabase/supabase-js'

// Wartości zaciągane z env (SWA: Configuration → Application settings)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://hgbkyawoejmzxjnrukep.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_1MmC4vtXsIsOnXvv_xt7Xw_pfyKxa0e'

// URL backendu (App Service); użyj VITE_API_URL w środowisku produkcyjnym
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const supabase = createClient(supabaseUrl, supabaseKey)

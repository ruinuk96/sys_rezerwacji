import { createClient } from '@supabase/supabase-js'

// Zamień na swoje wartości z Supabase → Settings → API
const supabaseUrl = 'https://hgbkyawoejmzxjnrukep.supabase.co'
const supabaseKey = 'sb_publishable_1MmC4vtXsIsOnXvv_xt7Xw_pfyKxa0e'

export const supabase = createClient(supabaseUrl, supabaseKey)

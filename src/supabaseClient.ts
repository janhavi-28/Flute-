import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ogiugaqlpvoqunwddjoc.supabase.co'
const supabaseAnonKey = 'sb_publishable_rygu1LDpnF0RG5iz03DeVA_PB4pPaVQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

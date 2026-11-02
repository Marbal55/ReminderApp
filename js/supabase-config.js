import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://bswlozxojwfcehjbodkp.supabase.co';
const supabaseKey = 'sb_publishable_p5J1C4onGKt1Wa_HTfDeOw_tz1ykitJ';

export const supabase = createClient(supabaseUrl, supabaseKey);
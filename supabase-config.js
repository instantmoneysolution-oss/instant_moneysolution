const SUPABASE_URL = "https://eypzqwfnuurimrucpjnc.supabase.co";

const SUPABASE_KEY = "sb_publishable_w5Ud8HipCytSC2_-mfUpbg_jPv4i4FM";

window.supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
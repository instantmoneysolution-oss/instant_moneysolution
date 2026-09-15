const SUPABASE_URL = "https://eypzqwfnuurimrucpjnc.supabase.co";

const SUPABASE_KEY = "sb_publishable_CbkK0Hr_U_hbe9uMpsPOuwA_6GMGHfK6";

window.supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
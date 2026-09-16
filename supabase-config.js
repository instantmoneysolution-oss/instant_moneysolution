const SUPABASE_URL = "https://tqgxdnlhmticsmoaeoqq.supabase.co";

const SUPABASE_KEY = "sb_publishable_CbkK0HrU_hbe9uMpsPOuwA_6GMGHfK6";

window.supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

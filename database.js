// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://eypzqwfnuurimrucpjnc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_CbkK0Hr_U_hbe9uMpsPOuwA_6GMGHfK6";


// Check that Supabase library is loaded
if (typeof supabase === "undefined") {
  console.error(
    "Supabase library is not loaded. Check the Supabase CDN script in your HTML."
  );
} else {

  // Create Supabase client
  window.supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log("Supabase client initialized.");
}

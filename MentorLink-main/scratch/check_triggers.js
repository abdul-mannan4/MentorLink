import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://isxxzkcanajavlrietue.supabase.co';
const supabaseKey = 'sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  const email = "23ntucsfl1003@student.ntu.edu.pk";
  const password = "23ntucsfl1003@student.ntu.edu.pk";

  console.log("Signing in...");
  await supabase.auth.signInWithPassword({ email, password });

  console.log("Checking triggers on chat_request...");
  // Let's run a query to find triggers and their functions using pg_trigger
  // We can query custom functions if there's any way or inspect the schema
  // But wait, the standard public API doesn't expose system catalogs unless we have permissions.
  // Let's see if we can query pg_trigger or if it returns permission denied.
  const { data: triggers, error } = await supabase
    .from("pg_trigger")
    .select("*");
  
  if (error) {
    console.error("Error fetching triggers:", error.message);
  } else {
    console.log("Triggers:", triggers);
  }
}

run();

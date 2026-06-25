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
  const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
  console.log("Logged in user id:", authData.user.id);

  // Try to delete chat 14 with select
  console.log("Deleting chat 14...");
  const { data: delChat14, error: err14 } = await supabase.from("chat").delete().eq("chat_id", 14).select();
  console.log("Delete chat 14 result:", { data: delChat14, error: err14 });

  // Try to delete chat 16 with select
  console.log("Deleting chat 16...");
  const { data: delChat16, error: err16 } = await supabase.from("chat").delete().eq("chat_id", 16).select();
  console.log("Delete chat 16 result:", { data: delChat16, error: err16 });
}

run();

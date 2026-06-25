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
  const userId = authData.user.id;
  console.log("Logged in user id:", userId);

  // Fetch as student
  console.log("\n--- Fetching as student ---");
  const { data: studentChats, error: sErr } = await supabase
    .from("chat")
    .select("*")
    .eq("student_id", userId);
  
  if (sErr) console.error("Error:", sErr);
  else console.log("Student Chats:", studentChats);

  // Fetch as mentor
  console.log("\n--- Fetching as mentor ---");
  const { data: mentorChats, error: mErr } = await supabase
    .from("chat")
    .select("*")
    .eq("mentor_id", userId);
  
  if (mErr) console.error("Error:", mErr);
  else console.log("Mentor Chats:", mentorChats);
}

run();

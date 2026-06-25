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
  const myId = authData.user.id;
  console.log("Logged in User ID:", myId);

  const { data: profiles } = await supabase.from("profile").select("id, name, user_name");
  const pMap = {};
  (profiles || []).forEach(p => { pMap[p.id] = p; });

  const { data: chats } = await supabase.from("chat").select("*");
  console.log("\n--- CHATS IN DATABASE ---");
  (chats || []).forEach(c => {
    const sName = pMap[c.student_id]?.name || pMap[c.student_id]?.user_name || c.student_id;
    const mName = pMap[c.mentor_id]?.name || pMap[c.mentor_id]?.user_name || c.mentor_id;
    console.log(`Chat ID: ${c.chat_id} | Student: ${sName} (${c.student_id}) | Mentor: ${mName} (${c.mentor_id}) | Status: ${c.status} | Created: ${c.created_at}`);
  });

  const { data: requests } = await supabase.from("chat_request").select("*");
  console.log("\n--- CHAT REQUESTS IN DATABASE ---");
  (requests || []).forEach(r => {
    const sName = pMap[r.student_id]?.name || pMap[r.student_id]?.user_name || r.student_id;
    const mName = pMap[r.mentor_id]?.name || pMap[r.mentor_id]?.user_name || r.mentor_id;
    console.log(`Req ID: ${r.request_id} | Student: ${sName} | Mentor: ${mName} | Status: ${r.status} | Created: ${r.created_at}`);
  });
}

run();

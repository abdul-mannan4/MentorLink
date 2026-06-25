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
  try {
    console.log("Fetching chats...");
    const { data: chats, error: chatsErr } = await supabase.from("chat").select("*");
    if (chatsErr) {
      console.error("Error fetching chats:", chatsErr);
    } else {
      console.log(`Found ${chats.length} chats:`, chats);
    }

    console.log("Fetching chat requests...");
    const { data: requests, error: reqsErr } = await supabase.from("chat_request").select("*");
    if (reqsErr) {
      console.error("Error fetching requests:", reqsErr);
    } else {
      console.log(`Found ${requests.length} requests:`, requests);
    }

    console.log("Fetching messages...");
    const { data: messages, error: msgsErr } = await supabase.from("message").select("*").limit(10);
    if (msgsErr) {
      console.error("Error fetching messages:", msgsErr);
    } else {
      console.log(`Found ${messages.length} messages (limit 10):`, messages);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();

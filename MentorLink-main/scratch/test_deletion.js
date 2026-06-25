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
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Sign-in failed:", authError.message);
    return;
  }

  const userId = authData.user.id;
  const targetMentorId = '30be028c-a61c-4710-b6cd-66b0b858a93c'; // Muhammad Hamza
  console.log(`Signed in. User ID: ${userId}`);

  // Create a dummy chat request with status pending
  const requestId = Math.floor(Math.random() * 1000000);
  console.log(`Inserting chat request with id ${requestId}...`);
  
  const { data: reqInsert, error: reqErr } = await supabase.from("chat_request").insert({
    request_id: requestId,
    student_id: userId,
    mentor_id: targetMentorId,
    message: "Test request pending",
    status: "pending"
  }).select();

  if (reqErr) {
    console.error("Failed to insert chat request:", reqErr.message);
    return;
  }
  console.log("Inserted chat request successfully:", reqInsert);

  // Update status to accepted
  console.log("Updating chat request status to accepted...");
  const { data: reqUpdate, error: updateErr } = await supabase
    .from("chat_request")
    .update({ status: "accepted" })
    .eq("request_id", requestId)
    .select();

  if (updateErr) {
    console.error("Failed to update chat request:", updateErr.message);
  } else {
    console.log("Updated chat request:", reqUpdate);
  }

  // Check if a chat was automatically created
  console.log("Checking if chat was automatically created...");
  const { data: chats, error: getChatErr } = await supabase
    .from("chat")
    .select("*")
    .eq("student_id", userId)
    .eq("mentor_id", targetMentorId);

  if (getChatErr) {
    console.error("Failed to fetch chats:", getChatErr.message);
  } else {
    console.log("Found chats:", chats);
  }

  // Let's clean up!
  // If a chat was created, let's try deleting it and the request.
  if (chats && chats.length > 0) {
    for (const chat of chats) {
      console.log(`Attempting to delete chat ${chat.chat_id}...`);
      const { error: delChatErr } = await supabase.from("chat").delete().eq("chat_id", chat.chat_id);
      if (delChatErr) {
        console.error(`Failed to delete chat ${chat.chat_id}:`, delChatErr.message);
      } else {
        console.log(`Deleted chat ${chat.chat_id} successfully.`);
      }
    }
  }

  console.log("Attempting to delete chat request...");
  const { error: delReqErr } = await supabase.from("chat_request").delete().eq("request_id", requestId);
  if (delReqErr) {
    console.error("Failed to delete chat request:", delReqErr.message);
  } else {
    console.log("Deleted chat request successfully.");
  }
}

run();

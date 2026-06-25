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

  // Create a chat request
  const requestId = Math.floor(Math.random() * 1000000);
  console.log(`1. Inserting chat request with id ${requestId}...`);
  
  const { data: reqInsert, error: reqErr } = await supabase.from("chat_request").insert({
    request_id: requestId,
    student_id: userId,
    mentor_id: targetMentorId,
    message: "Test request for cleanup check",
    status: "pending"
  }).select();

  if (reqErr) {
    console.error("Failed to insert chat request:", reqErr.message);
    return;
  }
  console.log("Inserted chat request:", reqInsert[0]);

  // Update status to accepted
  console.log("2. Updating chat request status to accepted...");
  const { data: reqUpdate, error: updateErr } = await supabase
    .from("chat_request")
    .update({ status: "accepted" })
    .eq("request_id", requestId)
    .select();

  if (updateErr) {
    console.error("Failed to update chat request:", updateErr.message);
    return;
  }
  console.log("Updated chat request:", reqUpdate[0]);

  // Fetch the automatically created chat
  console.log("3. Fetching the automatically created chat...");
  const { data: chats, error: getChatErr } = await supabase
    .from("chat")
    .select("*")
    .eq("request_id", requestId);

  if (getChatErr || !chats || chats.length === 0) {
    console.error("Failed to find created chat:", getChatErr?.message || "No chat found");
    return;
  }
  const chat = chats[0];
  console.log("Found chat:", chat);

  // Send a message in this chat
  const messageId = Math.floor(Math.random() * 1000000);
  console.log(`4. Sending a test message with id ${messageId}...`);
  const { data: msgData, error: msgErr } = await supabase.from("message").insert({
    message_id: messageId,
    chat_id: chat.chat_id,
    sender_id: userId,
    content: "Verification test message",
    sent_at: new Date().toISOString()
  }).select();

  if (msgErr) {
    console.error("Failed to insert message:", msgErr.message);
    return;
  }
  console.log("Inserted message:", msgData[0]);

  // Backdate the chat request, chat, and message to 4 days ago
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const backdateTime = fourDaysAgo.toISOString();

  console.log(`5. Backdating records to: ${backdateTime}...`);
  
  // Note: we might not have RLS UPDATE permission on chat or message created_at/sent_at, let's try it:
  const { error: backdateMsgErr } = await supabase
    .from("message")
    .update({ sent_at: backdateTime })
    .eq("message_id", messageId);
  if (backdateMsgErr) {
    console.warn("Backdating message failed (expected if RLS or schema blocks it):", backdateMsgErr.message);
  }

  const { error: backdateChatErr } = await supabase
    .from("chat")
    .update({ created_at: backdateTime })
    .eq("chat_id", chat.chat_id);
  if (backdateChatErr) {
    console.warn("Backdating chat failed:", backdateChatErr.message);
  }

  const { error: backdateReqErr } = await supabase
    .from("chat_request")
    .update({ created_at: backdateTime })
    .eq("request_id", requestId);
  if (backdateReqErr) {
    console.warn("Backdating chat request failed:", backdateReqErr.message);
  }

  // Double check if backdating succeeded
  console.log("6. Verifying current timestamps in DB...");
  const { data: dbChat } = await supabase.from("chat").select("created_at").eq("chat_id", chat.chat_id).single();
  const { data: dbMsg } = await supabase.from("message").select("sent_at").eq("message_id", messageId).single();
  const { data: dbReq } = await supabase.from("chat_request").select("created_at").eq("request_id", requestId).single();
  
  console.log("Chat created_at in DB:", dbChat?.created_at);
  console.log("Message sent_at in DB:", dbMsg?.sent_at);
  console.log("Request created_at in DB:", dbReq?.created_at);

  // Trigger RPC cleanup
  console.log("7. Calling delete_expired_chats RPC...");
  const { error: rpcErr } = await supabase.rpc("delete_expired_chats");
  if (rpcErr) {
    console.error("RPC execution failed:", rpcErr.message);
    return;
  }
  console.log("RPC call succeeded!");

  // Verify deletion
  console.log("8. Verifying if records were deleted...");
  const { data: verifyChat } = await supabase.from("chat").select("*").eq("chat_id", chat.chat_id);
  const { data: verifyMsg } = await supabase.from("message").select("*").eq("message_id", messageId);
  const { data: verifyReq } = await supabase.from("chat_request").select("*").eq("request_id", requestId);

  console.log("Chat exists:", verifyChat && verifyChat.length > 0);
  console.log("Message exists:", verifyMsg && verifyMsg.length > 0);
  console.log("Request exists:", verifyReq && verifyReq.length > 0);

  if (verifyChat.length === 0 && verifyMsg.length === 0 && verifyReq.length === 0) {
    console.log("SUCCESS: All expired records successfully deleted!");
  } else {
    console.log("FAILURE: Some records were not deleted.");
  }
}

run();

import { supabase } from "../supabase-client";

export interface ChatRequest {
  request_id: string;
  student_id: string;
  mentor_id: string;
  reply_id: number | null;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
}

export interface ChatProfile {
  name: string;
  user_name: string;
  profile_picture: string | null;
}

export interface Chat {
  chat_id: string;
  request_id: string | null;
  student_id: string;
  mentor_id: string;
  status: "active" | "archived";
  created_at: string;
  mentor_profile?: ChatProfile;
  student_profile?: ChatProfile;
  peer_profile?: ChatProfile;
  peer_id?: string;
  latest_message_time?: string;
  unread_count?: number;
}

export interface Message {
  message_id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  sent_at: string;
}

// 1. Send Chat Request (ensuring unique active requests)
export async function sendChatRequest(mentorId: string, replyId?: number, messageText?: string) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  // Enforce "Student can only request chat once for pending/accepted status"
  const { data: existingRequests, error: checkError } = await supabase
    .from("chat_request")
    .select("*")
    .eq("student_id", userId)
    .eq("mentor_id", mentorId);

  if (checkError) {
    console.error("Error checking existing requests:", checkError);
  }

  const activeRequestExists = existingRequests?.some(
    (req: ChatRequest) => req.status === "pending" || req.status === "accepted"
  );

  if (activeRequestExists) {
    return { error: "You already have a pending or accepted chat request with this mentor." };
  }

  // Check if the user has completed their profile
  const { data: userProfile } = await supabase
    .from("profile")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!userProfile) {
    return { error: "Please complete your profile from the dashboard before requesting a chat." };
  }

  // Insert chat request
  return supabase.from("chat_request").insert({
    request_id: Math.floor(Math.random() * 2147483647), // Generate random integer
    student_id: userId,
    mentor_id: mentorId,
    reply_id: replyId || null,
    message: messageText || "Hi! I would love to connect and chat about mentoring.",
    status: "pending"
  });
}

// 2. Respond to chat request (Accept / Reject)
export async function respondToChatRequest(requestId: string, status: "accepted" | "rejected") {
  // Get mentor details
  const { data: authData } = await supabase.auth.getUser();
  const mentorId = authData?.user?.id;
  
  if (mentorId) {
    // Get the student ID from the request
    const { data: requestData } = await supabase
      .from("chat_request")
      .select("student_id")
      .eq("request_id", requestId)
      .maybeSingle();
      
    if (requestData && requestData.student_id) {
      
      // Insert notification for the student
      await supabase.from("notification").insert({
        notification_id: Math.floor(Math.random() * 2147483647).toString(), // Generate random string ID
        recipient_id: requestData.student_id,
        sender_id: mentorId,
        type: status === "accepted" ? "chat_accepted" : "chat_rejected",
        is_read: false
      });
    }
  }

  return supabase
    .from("chat_request")
    .update({ status })
    .eq("request_id", requestId);
}

// 3. Fetch incoming/outgoing chat requests
export async function fetchChatRequests() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { data: { outgoing: [], incoming: [] }, error: "Unauthorized" };

  const { data: outgoing, error: outError } = await supabase
    .from("chat_request")
    .select("*")
    .eq("student_id", userId);

  const { data: incoming, error: inError } = await supabase
    .from("chat_request")
    .select("*")
    .eq("mentor_id", userId);

  if (outError || inError) {
    return { data: { outgoing: [], incoming: [] }, error: outError?.message || inError?.message };
  }

  // Join profile information for requests
  const outgoingWithProfiles = await Promise.all(
    (outgoing || []).map(async (req: ChatRequest) => {
      const { data: profile } = await supabase
        .from("profile")
        .select("name, user_name, profile_picture")
        .eq("id", req.mentor_id)
        .maybeSingle();
      return { ...req, mentor_profile: profile };
    })
  );

  const incomingWithProfiles = await Promise.all(
    (incoming || []).map(async (req: ChatRequest) => {
      const { data: profile } = await supabase
        .from("profile")
        .select("name, user_name, profile_picture")
        .eq("id", req.student_id)
        .maybeSingle();
      return { ...req, student_profile: profile };
    })
  );

  return {
    data: {
      outgoing: outgoingWithProfiles,
      incoming: incomingWithProfiles
    },
    error: null
  };
}

// 4a. Shared helper to decorate chats with peer profile, latest message, and unread count
async function decorateAndFilterChats(rawChats: Chat[], userId: string, role: "student" | "mentor") {
  const decorated = await Promise.all(
    rawChats.map(async (chat: Chat) => {
      const peerId = role === "student" ? chat.mentor_id : chat.student_id;

      const { data: profile } = await supabase
        .from("profile")
        .select("name, user_name, profile_picture")
        .eq("id", peerId)
        .maybeSingle();

      const { data: messages } = await supabase
        .from("message")
        .select("sent_at")
        .eq("chat_id", chat.chat_id)
        .order("sent_at", { ascending: false })
        .limit(1);

      const latestMessageTime = messages && messages.length > 0 ? messages[0].sent_at : null;

      const { count: unreadCount } = await supabase
        .from("message")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chat.chat_id)
        .eq("is_read", false)
        .neq("sender_id", userId);

      return {
        ...chat,
        peer_profile: profile,
        peer_id: peerId,
        latest_message_time: latestMessageTime,
        unread_count: unreadCount || 0
      };
    })
  );

  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
  const activeChats = decorated.filter((chat) => {
    const creationTime = new Date(chat.created_at).getTime();
    const messageTime = chat.latest_message_time ? new Date(chat.latest_message_time).getTime() : 0;
    const latestActivity = Math.max(creationTime, messageTime);
    return Date.now() - latestActivity <= threeDaysInMs;
  });

  // Sort active chats by latest activity (message or creation) descending
  activeChats.sort((a, b) => {
    const timeA = Math.max(new Date(a.created_at).getTime(), a.latest_message_time ? new Date(a.latest_message_time).getTime() : 0);
    const timeB = Math.max(new Date(b.created_at).getTime(), b.latest_message_time ? new Date(b.latest_message_time).getTime() : 0);
    return timeB - timeA;
  });

  // De-duplicate by peer_id to ensure only one active chat per peer is displayed
  const seenPeers = new Set<string>();
  return activeChats.filter((chat) => {
    if (!chat.peer_id) return true;
    if (seenPeers.has(chat.peer_id)) {
      return false;
    }
    seenPeers.add(chat.peer_id);
    return true;
  });
}

// 4b. Fetch conversations where the current user is the STUDENT (used in student dashboard)
export async function fetchConversationsAsStudent() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { data: [], error: "Unauthorized" };

  const { data: chats, error } = await supabase
    .from("chat")
    .select("*")
    .eq("student_id", userId);

  if (error) return { data: [], error: error.message };

  const filtered = await decorateAndFilterChats(chats || [], userId, "student");
  return { data: filtered, error: null };
}

// 4c. Fetch conversations where the current user is the MENTOR (used in mentor dashboard)
export async function fetchConversationsAsMentor() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { data: [], error: "Unauthorized" };

  const { data: chats, error } = await supabase
    .from("chat")
    .select("*")
    .eq("mentor_id", userId);

  if (error) return { data: [], error: error.message };

  const filtered = await decorateAndFilterChats(chats || [], userId, "mentor");
  return { data: filtered, error: null };
}

// 4. Fetch Conversations (both roles combined — kept for backward compatibility)
export async function fetchConversations() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { data: [], error: "Unauthorized" };

  const { data: chatsAsStudent, error: sErr } = await supabase
    .from("chat")
    .select("*")
    .eq("student_id", userId);

  const { data: chatsAsMentor, error: mErr } = await supabase
    .from("chat")
    .select("*")
    .eq("mentor_id", userId);

  if (sErr || mErr) {
    return { data: [], error: sErr?.message || mErr?.message };
  }

  const allChats = [...(chatsAsStudent || []), ...(chatsAsMentor || [])];

  const decoratedChats = await Promise.all(
    allChats.map(async (chat: Chat) => {
      const isStudent = chat.student_id === userId;
      const peerId = isStudent ? chat.mentor_id : chat.student_id;

      const { data: profile } = await supabase
        .from("profile")
        .select("name, user_name, profile_picture")
        .eq("id", peerId)
        .maybeSingle();

      const { data: messages } = await supabase
        .from("message")
        .select("sent_at")
        .eq("chat_id", chat.chat_id)
        .order("sent_at", { ascending: false })
        .limit(1);

      const latestMessageTime = messages && messages.length > 0 ? messages[0].sent_at : null;

      const { count: unreadCount } = await supabase
        .from("message")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chat.chat_id)
        .eq("is_read", false)
        .neq("sender_id", userId);

      return {
        ...chat,
        peer_profile: profile,
        peer_id: peerId,
        latest_message_time: latestMessageTime,
        unread_count: unreadCount || 0
      };
    })
  );

  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
  const filteredChats = decoratedChats.filter((chat) => {
    const creationTime = new Date(chat.created_at).getTime();
    const messageTime = chat.latest_message_time ? new Date(chat.latest_message_time).getTime() : 0;
    const latestActivity = Math.max(creationTime, messageTime);
    return Date.now() - latestActivity <= threeDaysInMs;
  });

  return { data: filteredChats, error: null };
}

// 5. Fetch messages inside a chat
export async function fetchMessages(chatId: string) {
  return supabase
    .from("message")
    .select("*")
    .eq("chat_id", chatId)
    .order("sent_at", { ascending: true });
}

// 6. Send a chat message
export async function sendMessage(chatId: string, content: string) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  return supabase.from("message").insert({
    message_id: Math.floor(Math.random() * 2147483647), // Generate random integer to bypass missing auto-increment in DB
    chat_id: chatId,
    sender_id: userId,
    content: content,
    is_read: false,
    sent_at: new Date().toISOString()
  });
}

// 7. Mark messages as read
export async function markMessagesAsRead(chatId: string) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return;

  // Find unread messages where user is NOT the sender
  const { data: unread } = await supabase
    .from("message")
    .select("message_id")
    .eq("chat_id", chatId)
    .eq("is_read", false)
    .neq("sender_id", userId);

  if (unread && unread.length > 0) {
    const unreadIds = unread.map((m: { message_id: string }) => m.message_id);
    for (const msgId of unreadIds) {
      await supabase
        .from("message")
        .update({ is_read: true })
        .eq("message_id", msgId);
    }
  }
}

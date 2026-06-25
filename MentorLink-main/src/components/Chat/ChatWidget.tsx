import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, ChevronDown, Send, ArrowLeft, MessageCircle, User as UserIcon, Check, Ban, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../supabase-client";
import { supabaseRealtime, setRealtimeAuth } from "../../supabase-realtime";
import {
  fetchConversationsAsStudent,
  fetchChatRequests,
  fetchMessages,
  sendMessage,
  respondToChatRequest,
  markMessagesAsRead
} from "../../utils/chat-api";
import type { Chat, Message, ChatRequest, ChatProfile } from "../../utils/chat-api";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import styles from "./ChatWidget.module.css";
import userIcon from "../../assets/userIcon.svg";
import { parseUTCDate } from "../../utils/date";

const ChatAvatar = ({ imagePath, name, className, fallbackIcon }: { imagePath?: string | null, name?: string, className?: string, fallbackIcon: string }) => {
  const signedUrl = useSignedImage(imagePath || null);
  // If we have a signedUrl, use it. Otherwise, use the fallbackIcon. 
  // However, avoid using a broken "null" or empty string from the DB.
  const src = (signedUrl && signedUrl !== "null" && signedUrl !== "") ? signedUrl : fallbackIcon;
  return <img src={src} alt={name || "User"} className={className} />;
};

interface DecoratedChatRequest extends ChatRequest {
  student_profile?: ChatProfile;
  mentor_profile?: ChatProfile;
}

export default function ChatWidget() {
  const location = useLocation();

  // Only show on student-mode pages, never on mentor-dashboard or any mentor-mode route
  const isStudentPage =
    location.pathname.includes("student") ||
    location.pathname.includes("userDashboard") ||
    location.pathname.startsWith("/mentor/") ||
    location.pathname.startsWith("/question/") ||
    location.pathname === "/profile";

  // Read the role the user is currently acting in (set by mode-switch buttons throughout the app)
  const [activeMode, setActiveMode] = useState<string>(
    () => sessionStorage.getItem("activeMode") || "student"
  );

  // Keep activeMode in sync whenever another component writes to sessionStorage
  useEffect(() => {
    const onStorage = () => {
      setActiveMode(sessionStorage.getItem("activeMode") || "student");
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("activeModeChanged", onStorage);
    // Also poll once on mount in case the value was set before this component mounted
    setActiveMode(sessionStorage.getItem("activeMode") || "student");
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("activeModeChanged", onStorage);
    };
  }, []);

  const isStudentDashboard = isStudentPage && activeMode !== "mentor";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "requests">("chats");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  
  // Chat List & Requests States
  const [chats, setChats] = useState<Chat[]>([]);
  const [requests, setRequests] = useState<{ incoming: DecoratedChatRequest[]; outgoing: DecoratedChatRequest[] }>({ incoming: [], outgoing: [] });
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingReqs, setLoadingReqs] = useState(false);

  // Active Chat states
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const activeChatRef = useRef<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const hasLoadedOnceRef = useRef(false);

  // 1. Fetch User and Role (with auth state listener to update dynamically)
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUser(data.user);
        // Check if mentor
        const { data: mentor } = await supabase
          .from("mentor")
          .select("mentor_id")
          .eq("mentor_id", data.user.id)
          .maybeSingle();
        setIsMentor(!!mentor);
      } else {
        setCurrentUser(null);
        setIsMentor(false);
      }
    };
    
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: mentor } = await supabase
          .from("mentor")
          .select("mentor_id")
          .eq("mentor_id", session.user.id)
          .maybeSingle();
        setIsMentor(!!mentor);
      } else {
        setCurrentUser(null);
        setIsMentor(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch Lists when user loads (only show loader once on initial load)
  useEffect(() => {
    if (!currentUser) return;
    
    const loadLists = async () => {
      const shouldShowLoader = !hasLoadedOnceRef.current;
      if (shouldShowLoader) {
        setLoadingChats(true);
        setLoadingReqs(true);
      }
      
      const [chatRes, reqRes] = await Promise.all([
        fetchConversationsAsStudent(),
        fetchChatRequests()
      ]);

      if (chatRes.data) setChats(chatRes.data);
      if (reqRes.data) setRequests(reqRes.data as { incoming: DecoratedChatRequest[]; outgoing: DecoratedChatRequest[] });
      
      if (shouldShowLoader) {
        setLoadingChats(false);
        setLoadingReqs(false);
        hasLoadedOnceRef.current = true;
      }
    };

    loadLists();
  }, [currentUser]);

  // 3. Auto-scroll chat history to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChat]);

  // 4. Open Chat Room & Initialize Realtime Subscriptions
  const handleOpenChat = useCallback(async (chat: Chat) => {
    setActiveChat(chat);
    activeChatRef.current = chat;
    setRealtimeAuth(); // Ensure access token is set for RLS in realtime socket

    // Fetch message history
    const { data: msgHistory } = await fetchMessages(chat.chat_id);
    if (msgHistory) setMessages(msgHistory);

    // Mark existing peer messages as read
    await markMessagesAsRead(chat.chat_id);

    // Unsubscribe from any previous channel
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }

    // Subscribe to new messages in realtime
    const channel = supabaseRealtime
      .channel(`chat_messages:${chat.chat_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter: `chat_id=eq.${chat.chat_id}`
        },
        async (payload: { new: Message }) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
            return [...prev, newMsg];
          });
          
          // Mark as read if the chat widget is active and we are not the sender
          if (currentUser && newMsg.sender_id !== currentUser.id) {
            await markMessagesAsRead(chat.chat_id);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, [currentUser]);

  // Close active conversation
  const handleCloseChat = () => {
    setActiveChat(null);
    activeChatRef.current = null;
    setMessages([]);
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }
    // Refresh chats to update unread counts or order
    fetchConversationsAsStudent().then((res) => {
      if (res.data) setChats(res.data);
    });
  };

  // 5. Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const messageText = inputText.trim();
    setInputText(""); // Clear input early for fast UI response

    // Optimistic UI Update
    const optimisticId = Math.floor(Math.random() * 2147483647).toString();
    if (currentUser) {
      const optimisticMsg: Message = {
        message_id: optimisticId,
        chat_id: activeChat.chat_id,
        sender_id: currentUser.id,
        content: messageText,
        is_read: false,
        sent_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    }

    const { error } = await sendMessage(activeChat.chat_id, messageText);
    if (error) {
      console.error("Failed to send message:", error);
      alert("Error sending message: " + error.message);
    }
  };

  // 6. Accept / Reject requests
  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await respondToChatRequest(requestId, "accepted");
    if (error) {
      alert("Error accepting request: " + error.message);
    } else {
      // Reload requests and chats
      const [chatRes, reqRes] = await Promise.all([
        fetchConversationsAsStudent(),
        fetchChatRequests()
      ]);
      if (chatRes.data) setChats(chatRes.data);
      if (reqRes.data) setRequests(reqRes.data as { incoming: DecoratedChatRequest[]; outgoing: DecoratedChatRequest[] });
      alert("Chat request accepted!");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await respondToChatRequest(requestId, "rejected");
    if (error) {
      alert("Error rejecting request: " + error.message);
    } else {
      const { data } = await fetchChatRequests();
      if (data) setRequests(data as { incoming: DecoratedChatRequest[]; outgoing: DecoratedChatRequest[] });
      alert("Chat request rejected.");
    }
  };

  // Unsubscribe on unmount and register open-chat event listener
  useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ peerId: string }>;
      const peerId = customEvent.detail?.peerId;
      if (!peerId) return;
      setIsOpen(true);
      const chat = chats.find((c) => c.peer_id === peerId);
      if (chat) {
        handleOpenChat(chat);
      } else {
        fetchConversationsAsStudent().then((res) => {
          if (res.data) {
            setChats(res.data);
            const updatedChat = res.data.find((c) => c.peer_id === peerId);
            if (updatedChat) {
              handleOpenChat(updatedChat);
            }
          }
        });
      }
    };

    window.addEventListener("open-chat", handleOpenChatEvent);
    return () => {
      window.removeEventListener("open-chat", handleOpenChatEvent);
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
      }
    };
  }, [chats, handleOpenChat]);

  // Global realtime message listener for notifications and unread badges
  useEffect(() => {
    if (!currentUser) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const channel = supabaseRealtime
      .channel(`chat_widget_global_messages:${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message"
        },
        async (payload: { new: Message }) => {
          const newMsg = payload.new;

          if (newMsg.sender_id !== currentUser.id) {
            // Refresh conversations list in real-time
            const chatRes = await fetchConversationsAsStudent();
            if (chatRes.data) setChats(chatRes.data);

            // Show browser notification if widget is closed or this chat room is not active
            if (!isOpen || !activeChatRef.current || activeChatRef.current.chat_id !== newMsg.chat_id) {
              if ("Notification" in window && Notification.permission === "granted") {
                try {
                  const { data: senderProfile } = await supabase
                    .from("profile")
                    .select("name")
                    .eq("id", newMsg.sender_id)
                    .single();

                  new Notification(`New message from ${senderProfile?.name || "User"}`, {
                    body: newMsg.content,
                    tag: newMsg.chat_id
                  });
                } catch (err) {
                  console.error("Error showing message notification:", err);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser, isOpen]);

  const queryParams = new URLSearchParams(location.search);
  const isChatsTabActive = queryParams.get("tab") === "chats";

  if (!currentUser || !isStudentDashboard || isChatsTabActive) return null;

  return (
    <div className={styles.widgetContainer}>
      {/* Floating Chat Bubble Button */}
      <motion.button
        className={styles.floatingBubble}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open chat panel"
      >
        {isOpen ? <ChevronDown size={28} /> : <MessageSquare size={24} />}
        {chats.reduce((acc, c) => acc + (c.unread_count || 0), 0) > 0 && !isOpen && (
          <span className={styles.unreadBadge}>
            {chats.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
          </span>
        )}
      </motion.button>

      {/* Slide-out Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.chatBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className={styles.chatPanel}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
            {activeChat ? (
              /* Chat Conversation Window */
              <div className={styles.chatRoom}>
                <div className={styles.chatHeader}>
                  <button className={styles.backBtn} onClick={handleCloseChat} aria-label="Back to chat list">
                    <ArrowLeft size={20} />
                  </button>
                  <ChatAvatar
                    imagePath={activeChat.peer_profile?.profile_picture}
                    name={activeChat.peer_profile?.name || "Peer"}
                    className={styles.peerAvatar}
                    fallbackIcon={userIcon}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 className={styles.peerName}>{activeChat.peer_profile?.name || activeChat.peer_profile?.user_name || "Mentor"}</h4>
                    <span className={styles.peerStatus}>Connected Chat</span>
                  </div>
                  <button className={styles.backBtn} onClick={() => setIsOpen(false)} aria-label="Close widget">
                    <X size={20} />
                  </button>
                </div>

                <div className={styles.messageArea}>
                  {messages.length === 0 ? (
                    <div className={styles.emptyMessages}>
                      <MessageCircle size={36} className={styles.emptyIcon} />
                      <p>Start exchanging messages now!</p>
                      <span className={styles.expiryDisclaimer}>Chat will stay active for 3 days from last activity.</span>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUser.id;
                      return (
                        <div
                          key={msg.message_id}
                          className={`${styles.messageWrapper} ${isMe ? styles.meWrapper : styles.peerWrapper}`}
                        >
                          <div className={`${styles.bubble} ${isMe ? styles.meBubble : styles.peerBubble}`}>
                            <p className={styles.messageText}>{msg.content}</p>
                            <span className={styles.timestamp}>
                              {parseUTCDate(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className={styles.inputBar}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className={styles.messageInput}
                  />
                  <button type="submit" className={styles.sendBtn} disabled={!inputText.trim()}>
                    <Send size={18} />
                  </button>
                </form>
              </div>
            ) : (
              /* Chat Directory (List View) */
              <div className={styles.directory}>
                <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>NTUConnect Chats</h3>
                    <p>Exchange questions & advice</p>
                  </div>
                  <button className={`${styles.backBtn} ${styles.closeBtn}`} onClick={() => setIsOpen(false)} aria-label="Close widget">
                    <X size={20} />
                  </button>
                </div>

                {/* Dashboard Tabs */}
                <div className={styles.tabHeaders}>
                  <button
                    className={`${styles.tabBtn} ${activeTab === "chats" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("chats")}
                  >
                    Chats
                  </button>
                  <button
                    className={`${styles.tabBtn} ${activeTab === "requests" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("requests")}
                  >
                    Requests
                    {isMentor && requests.incoming.some(r => r.status === "pending") && (
                      <span className={styles.tabNotif}></span>
                    )}
                  </button>
                </div>

                <div className={styles.panelContent}>
                  {activeTab === "chats" ? (
                    /* Conversations List */
                    <div className={styles.conversationsList}>
                      {loadingChats ? (
                        <p className={styles.emptyState}>Loading chats...</p>
                      ) : chats.length === 0 ? (
                        <div className={styles.emptyState}>
                          <MessageCircle size={36} />
                          <p>No active conversations.</p>
                          <span>Requests can be sent directly from any Mentor Profile.</span>
                        </div>
                      ) : (
                        chats.map((chat) => (
                          <div
                            key={chat.chat_id}
                            className={styles.conversationCard}
                            onClick={() => handleOpenChat(chat)}
                          >
                            <ChatAvatar
                              imagePath={chat.peer_profile?.profile_picture}
                              name={chat.peer_profile?.name || "Participant"}
                              className={styles.chatAvatar}
                              fallbackIcon={userIcon}
                            />
                            <div className={styles.chatDetails}>
                              <div className={styles.chatRow}>
                                <h4 className={styles.chatName}>
                                  {chat.peer_profile?.name || chat.peer_profile?.user_name || "Mentor"}
                                </h4>
                                {chat.latest_message_time && (
                                  <span className={styles.chatTime}>
                                    {parseUTCDate(chat.latest_message_time).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p className={styles.chatPreview}>
                                  Click to open chat room
                                </p>
                                {chat.unread_count && chat.unread_count > 0 ? (
                                  <span className={styles.inlineUnreadBadge}>{chat.unread_count}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Connections Requests Panel */
                    <div className={styles.requestsPanel}>
                      {loadingReqs ? (
                        <p className={styles.emptyState}>Loading requests...</p>
                      ) : (
                        <>
                          {/* Incoming requests (Only shown for Mentor roles) */}
                          {isMentor && (
                            <div className={styles.requestsSection}>
                              <h4 className={styles.subHeader}>Incoming Requests</h4>
                              {requests.incoming.length === 0 ? (
                                <p className={styles.subEmpty}>No incoming requests.</p>
                              ) : (
                                requests.incoming.map((req) => (
                                  <div key={req.request_id} className={styles.requestCard}>
                                    <div className={styles.reqTop}>
                                      <div className={styles.reqProfile}>
                                        <UserIcon size={16} />
                                        <span>{req.student_profile?.name || req.student_profile?.user_name || "Student"}</span>
                                      </div>
                                      <span className={`${styles.statusLabel} ${styles[req.status]}`}>{req.status}</span>
                                    </div>
                                    <p className={styles.reqMsg}>"{req.message}"</p>
                                    {req.status === "pending" && (
                                      <div className={styles.reqActions}>
                                        <button
                                          className={styles.acceptBtn}
                                          onClick={() => handleAcceptRequest(req.request_id)}
                                        >
                                          <Check size={14} /> Accept
                                        </button>
                                        <button
                                          className={styles.rejectBtn}
                                          onClick={() => handleRejectRequest(req.request_id)}
                                        >
                                          <Ban size={14} /> Reject
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                          {/* Outgoing requests */}
                          <div className={styles.requestsSection}>
                            <h4 className={styles.subHeader}>Outgoing Requests</h4>
                            {requests.outgoing.length === 0 ? (
                              <p className={styles.subEmpty}>No sent requests.</p>
                            ) : (
                              requests.outgoing.map((req) => (
                                <div key={req.request_id} className={styles.requestCard}>
                                  <div className={styles.reqTop}>
                                    <div className={styles.reqProfile}>
                                      <UserIcon size={16} />
                                      <span>{req.mentor_profile?.name || req.mentor_profile?.user_name || "Mentor"}</span>
                                    </div>
                                    <span className={`${styles.statusLabel} ${styles[req.status]}`}>{req.status}</span>
                                  </div>
                                  <p className={styles.reqMsg}>"{req.message}"</p>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

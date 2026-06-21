import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCache, setCache } from "../../utils/cache";
import { motion, AnimatePresence } from "framer-motion";
import { Groq } from "groq-sdk";
import { supabase } from "../../supabase-client";
import style from './MentorDashboard.module.css';
import ModeButton from "../ModeButton/ModeButton";
import {
  fetchChatRequests,
  respondToChatRequest,
  fetchConversationsAsMentor,
  fetchMessages,
  sendMessage,
  markMessagesAsRead
} from "../../utils/chat-api";
import type { ChatRequest, ChatProfile, Chat, Message } from "../../utils/chat-api";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import { supabaseRealtime, setRealtimeAuth } from "../../supabase-realtime";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { MessageSquare, Send, ArrowLeft, MessageCircle, Award } from "lucide-react";
import userIcon from "../../assets/userIcon.svg";

const ChatAvatar = ({ imagePath, name, className, fallbackIcon }: { imagePath?: string | null, name?: string, className?: string, fallbackIcon: string }) => {
  const signedUrl = useSignedImage(imagePath || null);
  const src = (signedUrl && signedUrl !== "null" && signedUrl !== "") ? signedUrl : fallbackIcon;
  return <img src={src} alt={name || "User"} className={className} />;
};

interface DecoratedChatRequest extends ChatRequest {
  student_profile?: ChatProfile;
  mentor_profile?: ChatProfile;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Subject {
  "Course Name"?: string;
  course_name?: string;
  marks: number;
  test_taken_at?: string;
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TestData {
  questions: Question[];
}

interface ScoreSummary {
  score: number;
  total: number;
}

interface Notification {
  notification_id: string;
  question_id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  topic?: string;
  subject?: string;
  has_replied?: boolean;
}

// ─── Groq Client ─────────────────────────────────────────────────────────────

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
const groq = groqApiKey ? new Groq({
  apiKey: groqApiKey,
  dangerouslyAllowBrowser: true,
}) : null;

// ─── Component ───────────────────────────────────────────────────────────────

export default function MentorDashboard() {
  const navigate = useNavigate();
  const [activeMode] = useState<string | null>(() => {
    const mode = sessionStorage.getItem("activeMode");
    return mode || "mentor";
  });

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedText, setGeneratedText] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  const [testData, setTestData] = useState<TestData | null>(null);
  const [testActive, setTestActive] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentorRank, setMentorRank] = useState<{ current_rank: number; points: number; total_replies: number } | null>(null);
  const [chatRequests, setChatRequests] = useState<DecoratedChatRequest[]>([]);

  // Chat integration states & refs
  const [activeTabSection, setActiveTabSection] = useState<"tasks" | "chats">("tasks");
  const [conversations, setConversations] = useState<Chat[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const selectedChatRef = useRef<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const mode = sessionStorage.getItem("activeMode");
    if (mode === "student") {
      navigate("/student", { replace: true });
    } else if (!mode) {
      sessionStorage.setItem("activeMode", "mentor");
    }
  }, [navigate]);

  const handleSwitchToStudent = () => {
    sessionStorage.setItem("activeMode", "student");
    navigate("/student", { replace: true });
  };

  console.debug(generatedText);

  const fetchSubjects = async (currentUserId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("mentor_subjects")
        .select("*")
        .eq("mentor_id", currentUserId);
      if (error) throw error;
      setSubjects((data as Subject[]) || []);
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  const fetchNotifications = async (currentUserId: string): Promise<void> => {
    const cached = getCache("mentorNotifications");
    if (cached) {
      setNotifications(cached);
      return;
    }
    try {
      // Step 0: Auto-backfill missing notifications for existing questions
      const { data: mentorSubjects } = await supabase
        .from("mentor_subjects")
        .select("course_name")
        .eq("mentor_id", currentUserId);

      if (mentorSubjects && mentorSubjects.length > 0) {
        const subjectNames = mentorSubjects.map((s: { course_name: string }) => s.course_name).filter(Boolean);

        // Fetch all questions for these subjects
        const { data: questionsData } = await supabase
          .from("question")
          .select("question_id, student_id")
          .in("subject", subjectNames);

        if (questionsData && questionsData.length > 0) {
          // Fetch existing notifications for this mentor
          const { data: existingNotifs } = await supabase
            .from("notification")
            .select("question_id")
            .eq("recipient_id", currentUserId)
            .eq("type", "new_question");

          const existingQids = new Set(existingNotifs?.map((n: { question_id: string }) => n.question_id) || []);

          // Find questions without notifications
          const missingNotifs = questionsData
            .filter((q: { question_id: string; student_id: string }) => !existingQids.has(q.question_id))
            .map((q: { question_id: string; student_id: string }) => ({
              recipient_id: currentUserId,
              sender_id: q.student_id,
              question_id: q.question_id,
              type: "new_question"
            }));

          if (missingNotifs.length > 0) {
            await supabase.from("notification").insert(missingNotifs);
          }
        }
      }

      // Step 1: Fetch notifications WITHOUT the join
      const { data: notifData, error: notifError } = await supabase
        .from("notification")
        .select("*")
        .eq("recipient_id", currentUserId)
        .eq("type", "new_question")
        .order("created_at", { ascending: false });

      if (notifError) {
        console.error("Error fetching notifications:", notifError.message);
        return;
      }

      if (!notifData || notifData.length === 0) {
        setNotifications([]);
        setCache("mentorNotifications", []);
        return;
      }

      // Step 2: Fetch the corresponding questions manually
      const questionIds = notifData.map((n: Notification) => n.question_id).filter((id: string) => id != null);
      let questionsMap: Record<string, { question_id: string; topic: string; subject: string }> = {};

      if (questionIds.length > 0) {
        const { data: qData, error: qError } = await supabase
          .from("question")
          .select("question_id, topic, subject")
          .in("question_id", questionIds);

        if (!qError && qData) {
          questionsMap = qData.reduce((acc: Record<string, { question_id: string; topic: string; subject: string }>, q: { question_id: string; topic: string; subject: string }) => {
            acc[q.question_id] = q;
            return acc;
          }, {});
        }
      }

      // Step 3: Fetch replies for this mentor
      const { data: replyData } = await supabase
        .from("reply")
        .select("question_id")
        .eq("mentor_id", currentUserId);

      const repliedSet = new Set(replyData?.map((r: { question_id: string }) => r.question_id) || []);

      const formatted = notifData.map((n: Notification) => ({
        ...n,
        topic: questionsMap[n.question_id]?.topic || "New Question",
        subject: questionsMap[n.question_id]?.subject || "Student Query",
        has_replied: repliedSet.has(n.question_id)
      }));

      formatted.sort((a: Notification, b: Notification) => {
        if (a.has_replied === b.has_replied) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.has_replied ? 1 : -1;
      });

      setNotifications(formatted);
      setCache("mentorNotifications", formatted);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const fetchMentorRank = async (currentUserId: string): Promise<void> => {
    const cached = getCache("mentorRank");
    if (cached) {
      setMentorRank(cached);
      return;
    }
    try {
      const [{ data: replies }, { data: subjs }, { data: globalMentors }] = await Promise.all([
        supabase.from("reply").select("mentor_id").eq("mentor_id", currentUserId),
        supabase.from("mentor_subjects").select("marks").eq("mentor_id", currentUserId),
        supabase.from("mentor").select("mentor_id")
      ]);

      const safeSubjects = subjs ?? [];
      const totalReplies = replies?.length ?? 0;

      const avgScore = safeSubjects.length > 0
        ? safeSubjects.reduce((sum: number, s: Subject) => sum + (s.marks >= 0 ? s.marks : 0), 0) / safeSubjects.length
        : 0;

      const points = (avgScore * 8) + (totalReplies * 4) + (Math.log1p(totalReplies) * 5);

      const mentorIds = (globalMentors || []).map((m: { mentor_id: string }) => m.mentor_id);
      if (mentorIds.length > 0) {
        const [{ data: allReplies }, { data: allSubjects }] = await Promise.all([
          supabase.from("reply").select("mentor_id").in("mentor_id", mentorIds),
          supabase.from("mentor_subjects").select("mentor_id, marks").in("mentor_id", mentorIds)
        ]);

        const rMap: Record<string, number> = {};
        allReplies?.forEach((r: { mentor_id: string | null }) => { if(r.mentor_id) rMap[r.mentor_id] = (rMap[r.mentor_id] || 0) + 1; });

        const sMap: Record<string, { total: number; count: number }> = {};
        allSubjects?.forEach((s: { mentor_id: string | null; marks: number }) => {
          if(!s.mentor_id || s.marks < 0) return;
          const current = sMap[s.mentor_id] || { total: 0, count: 0 };
          current.total += s.marks;
          current.count += 1;
          sMap[s.mentor_id] = current;
        });

        const scoreboard = mentorIds.map((id: string) => {
          const mReplies = rMap[id] || 0;
          const sData = sMap[id];
          const mAvg = sData && sData.count > 0 ? sData.total / sData.count : 0;
          const mPoints = (mAvg * 8) + (mReplies * 4) + (Math.log1p(mReplies) * 5);
          return { id, score: mPoints };
        });

        scoreboard.sort((a: { id: string; score: number }, b: { id: string; score: number }) => b.score - a.score);
        const derivedRank = scoreboard.findIndex((item: { id: string; score: number }) => item.id === currentUserId) + 1;

        const rankObj = {
          current_rank: derivedRank > 0 ? derivedRank : 1,
          points: Math.round(points),
          total_replies: totalReplies,
        };
        setMentorRank(rankObj);
        setCache("mentorRank", rankObj);
        return;
      }

      const rankObj = {
        current_rank: 1,
        points: Math.round(points),
        total_replies: totalReplies,
      };
      setMentorRank(rankObj);
      setCache("mentorRank", rankObj);
    } catch (err) {
      console.error("Error fetching mentor rank:", err);
    }
  };

  const loadRequests = async () => {
    const { data } = await fetchChatRequests();
    if (data?.incoming) {
      setChatRequests(data.incoming.filter(r => r.status === "pending"));
    }
  };

  const loadConversations = async () => {
    setLoadingConversations(true);
    const { data } = await fetchConversationsAsMentor();
    if (data) {
      setConversations(data);
    }
    setLoadingConversations(false);
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    selectedChatRef.current = chat;
    setRealtimeAuth();

    const { data: msgHistory } = await fetchMessages(chat.chat_id);
    if (msgHistory) setChatMessages(msgHistory);

    await markMessagesAsRead(chat.chat_id);

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }

    const channel = supabaseRealtime
      .channel(`dashboard_chat_messages:${chat.chat_id}`)
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
          setChatMessages((prev) => {
            if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
            return [...prev, newMsg];
          });
          
          if (userId && newMsg.sender_id !== userId) {
            await markMessagesAsRead(chat.chat_id);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  const handleDeselectChat = () => {
    setSelectedChat(null);
    selectedChatRef.current = null;
    setChatMessages([]);
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }
    loadConversations();
  };

  const handleSendDashboardMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChat) return;

    const messageText = messageInput.trim();
    setMessageInput("");

    const { data: newMsg, error } = await sendMessage(selectedChat.chat_id, messageText);
    if (error) {
      setToastMessage("Error sending message: " + error.message);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    } else if (newMsg && newMsg.length > 0) {
      setChatMessages((prev) => {
        if (prev.some((m) => m.message_id === newMsg[0].message_id)) return prev;
        return [...prev, newMsg[0]];
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, selectedChat]);

  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
      }
    };
  }, []);

  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await respondToChatRequest(requestId, "accepted");
    if (error) {
      setToastMessage("Error accepting request: " + error.message);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage("Chat request accepted successfully!");
      setTimeout(() => setToastMessage(null), 4000);
      loadRequests();
      loadConversations();
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await respondToChatRequest(requestId, "rejected");
    if (error) {
      setToastMessage("Error rejecting request: " + error.message);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage("Chat request rejected.");
      setTimeout(() => setToastMessage(null), 4000);
      loadRequests();
      loadConversations();
    }
  };

  useEffect(() => {
    let notifChannel: RealtimeChannel | null = null;
    let msgChannel: RealtimeChannel | null = null;

    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        navigate("/", { replace: true });
        return;
      }
      setUserId(user.id);
      fetchSubjects(user.id);
      fetchNotifications(user.id);
      fetchMentorRank(user.id);
      loadRequests();
      loadConversations();

      // Request browser notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      // Realtime subscription for mentor notifications (new questions)
      notifChannel = supabaseRealtime
        .channel(`mentor_notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notification",
            filter: `recipient_id=eq.${user.id}`
          },
          async (payload: { new: { question_id: string; notification_id: string } }) => {
            fetchNotifications(user.id);
            fetchMentorRank(user.id);

            if ("Notification" in window && Notification.permission === "granted") {
              try {
                const { data: qData } = await supabase
                  .from("question")
                  .select("subject, topic")
                  .eq("question_id", payload.new.question_id)
                  .single();

                const subjectStr = qData?.subject || "Student Query";
                const topicStr = qData?.topic || "New Question";
                new Notification("New Question Asked!", {
                  body: `Subject: ${subjectStr}\nTopic: ${topicStr}`,
                  tag: payload.new.notification_id,
                });
              } catch (err) {
                console.error("Error showing browser notification:", err);
              }
            }
          }
        )
        .subscribe();

      // Realtime subscription for new chat messages
      msgChannel = supabaseRealtime
        .channel(`mentor_global_messages:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "message"
          },
          async (payload: { new: Message }) => {
            const newMsg = payload.new;

            if (newMsg.sender_id !== user.id) {
              // Refresh active chats list
              loadConversations();

              // Trigger desktop system notification if not currently viewing this chat
              if (selectedChatRef.current?.chat_id !== newMsg.chat_id) {
                if ("Notification" in window && Notification.permission === "granted") {
                  try {
                    const { data: senderProfile } = await supabase
                      .from("profile")
                      .select("name")
                      .eq("id", newMsg.sender_id)
                      .single();

                    new Notification(`New message from ${senderProfile?.name || "Student"}`, {
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
    };
    init();

    return () => {
      if (notifChannel) notifChannel.unsubscribe();
      if (msgChannel) msgChannel.unsubscribe();
    };
  }, [navigate]);

  const pendingSubjects = subjects.filter((s) => s.marks === -1);
  const completedSubjects = subjects.filter((s) => s.marks >= 0 && s.marks <= 15);

  const submitTest = useCallback(async (): Promise<void> => {
    if (!testData || !userId) return;
    let marks = 0;
    testData.questions.forEach((q, index) => {
      if (userAnswers[index] === q.correctAnswer) marks++;
    });
    const now = new Date().toISOString();

    // Find the previous score for this subject from the local subjects state
    const currentSubject = subjects.find(
      (s) => (s.course_name || s["Course Name"]) === activeTask
    );
    const previousScore = currentSubject ? currentSubject.marks : -1;

    try {
      const updatePayload: { test_taken_at: string; marks?: number } = { test_taken_at: now };

      // Only update the score in the database if the new score is higher
      if (marks > previousScore) {
        updatePayload.marks = marks;
      }

      const { error } = await supabase
        .from("mentor_subjects")
        .update(updatePayload)
        .eq("mentor_id", userId)
        .eq("course_name", activeTask);
      if (error) throw error;
      setScoreSummary({ score: marks, total: testData.questions.length });
    } catch (err) {
      console.error("Error updating marks:", err);
    }
  }, [testData, userId, userAnswers, subjects, activeTask]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (testActive && !scoreSummary && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (testActive && !scoreSummary && timeLeft === 0) {
      Promise.resolve().then(() => {
        submitTest();
      });
    }
    return () => clearInterval(timer);
  }, [testActive, timeLeft, scoreSummary, submitTest]);

  const closeTest = (): void => {
    setTestActive(false);
    setActiveTask(null);
    setTestData(null);
    setScoreSummary(null);
    if (userId) {
      // Invalidate cache since scores and rank updated
      setCache("mentorSubjects", undefined);
      setCache("mentorRank", undefined);
      fetchSubjects(userId);
      fetchNotifications(userId);
      fetchMentorRank(userId);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.subject) {
        navigate(`/question/${notif.question_id}`);
        return;
      }

      const cleanNotifSubject = notif.subject.toLowerCase().trim();

      const targetSubject = subjects.find((s) => {
        const name = (s.course_name || s["Course Name"] || "").toLowerCase().trim();
        return name.includes(cleanNotifSubject) || cleanNotifSubject.includes(name);
      });

      if (!targetSubject || targetSubject.marks === -1) {
        setToastMessage(`You must take and complete the ${notif.subject} test before replying.`);
        setTimeout(() => setToastMessage(null), 4000);
        return; 
      }

      if (!notif.is_read) {
        const { error } = await supabase
          .from("notification")
          .update({ is_read: true })
          .eq("notification_id", notif.notification_id);

        if (!error) {
          const updated = notifications.map((n) =>
            n.notification_id === notif.notification_id ? { ...n, is_read: true } : n
          );
          setNotifications(updated);
          setCache("mentorNotifications", updated);
        }
      }
      navigate(`/question/${notif.question_id}`);
    } catch (err) {
      console.error("Error handling notification click:", err);
      navigate(`/question/${notif.question_id}`);
    }
  };

  const handleRetakeTest = (subjectObj: Subject): void => {
    const subjectName = subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
    if (subjectObj.test_taken_at) {
      const takenAt = new Date(subjectObj.test_taken_at).getTime();
      // eslint-disable-next-line react-hooks/purity
      const diffMs = Date.now() - takenAt;
      const cooldownMs = 0; // Allow instant retakes during testing
      if (diffMs < cooldownMs) {
        const remainingMs = cooldownMs - diffMs;
        const remainingMins = Math.floor(remainingMs / 60000);
        const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
        let msg = "You must wait ";
        if (remainingMins > 0) msg += `${remainingMins} minute${remainingMins > 1 ? "s" : ""} `;
        if (remainingMins > 0 && remainingSecs > 0) msg += "and ";
        if (remainingSecs > 0 || remainingMins === 0) msg += `${remainingSecs} second${remainingSecs !== 1 ? "s" : ""} `;
        msg += "more before retaking this test.";
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }
    }
    runGroqGeneration(subjectName);
  };

  const runGroqGeneration = async (subjectName: string): Promise<void> => {
    setActiveTask(subjectName);
    setIsGenerating(true);
    setGeneratedText("");

    if (!groq) {
      console.warn("Groq API Key is missing. Using local mock test generator.");
      setTimeout(() => {
        const mockQuestions: Question[] = [];
        for (let i = 1; i <= 15; i++) {
          mockQuestions.push({
            question: `Mock Question ${i} for ${subjectName}: What is the fundamental concept of this topic?`,
            options: [
              `Option A for concept ${i}`,
              `Option B for concept ${i} (Correct option)`,
              `Option C for concept ${i}`,
              `Option D for concept ${i}`
            ],
            correctAnswer: 1
          });
        }
        setTestData({ questions: mockQuestions });
        setTestActive(true);
        setScoreSummary(null);
        setTimeLeft(180);
        setUserAnswers({});
        setIsGenerating(false);
      }, 1500);
      return;
    }

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:"You are an expert university-level exam question generator. Your task is to create exactly 15 multiple-choice questions (MCQs), no more no less, exactly 15, in json format based on the subject provided by the user. Each question should have normal difficulty, suitable for university students. You MUST output ONLY valid JSON using this exact schema, with no additional text or formatting: { \"questions\": [ { \"question\": \"Question text here\", \"options\": [\"Option 1 text\", \"Option 2 text\", \"Option 3 text\", \"Option 4 text\"], \"correctAnswer\": 0 } ] } where correctAnswer is the integer index (0-3) of the correct option. Make sure that options contain the actual detailed answer text corresponding to the question, NOT literal placeholder letters A, B, C, D. Ensure options are distinct and random, and make sure there are exactly 15 questions."
          },
          { role: "user", content: subjectName },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_completion_tokens: 4096,
        top_p: 1,
        stream: true,
        stop: null,
      });
      let accumulatedText = "";
      for await (const chunk of chatCompletion) {
        const text = chunk.choices[0]?.delta?.content || "";
        accumulatedText += text;
        setGeneratedText(accumulatedText);
      }
      try {
        const jsonMatch = accumulatedText.match(/\{[\s\S]*\}/);
        const parsed: TestData = JSON.parse(jsonMatch ? jsonMatch[0] : accumulatedText);
        if (parsed?.questions?.length > 0) {
          setTestData(parsed);
          setTestActive(true);
          setScoreSummary(null);
          setTimeLeft(180);
          setUserAnswers({});
          setIsGenerating(false);
        }
      } catch (e) {
        console.error("Failed to parse JSON", e);
      }
    } catch (error: unknown) {
      const err = error as Error;
      setGeneratedText(`Error generating questions: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (activeMode !== "mentor") {
    return null;
  }

  return (
    <div className={style['mentor-root']}>
      {/* Navbar */}
      <nav className={style['mentor-nav']}>
        <div className={style['mentor-nav-inner']}>
          <Link to="/" className={style['mentor-nav-brand']}>
            MentorLink Dashboard
          </Link>
          <div className={style['mentor-nav-right']}>
            <ModeButton />
            <Link to="/mentor-profile" className={style['mentor-edit-btn']}>Edit Profile</Link>
            <Link
              to="/student"
              className={style['mentor-switch-btn']}
              onClick={(e) => {
                e.preventDefault();
                handleSwitchToStudent();
              }}
            >
              Switch to Student
            </Link>
            <span className={style['mentor-mode-badge']}>Mentor Mode</span>
          </div>
        </div>
      </nav>

      {/* Main Responsive Grid Layout */}
      <main className={style['mentor-main']}>
        <div className={style['mentor-layout-grid']}>
          
          {/* Left Column: Notifications Panel */}
          <aside className={style['mentor-notifications-panel']}>
            <div className={style['mentor-section-header-row']}>
              <h2 className={style['mentor-panel-title']}>Recent Notifications</h2>
              {mentorRank ? (
                <div className={style['mentor-rank-badge']}>
                  <span>Rank #{mentorRank.current_rank}</span>
                  <span className={style['mentor-rank-divider']}>|</span>
                  <strong>{mentorRank.points} pts</strong>
                </div>
              ) : (
                <div className={style['mentor-rank-badge']}>
                  <span>Unranked</span>
                </div>
              )}
            </div>
            
            <div className={style['mentor-notifications-list']}>
              {notifications.length === 0 ? (
                <p className={style['mentor-no-notif-text']}>No new notifications yet.</p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.notification_id}
                    className={`${style['mentor-notification-item']} ${!notif.is_read && !notif.has_replied ? style['mentor-notification-unread'] : ''} ${notif.has_replied ? style['mentor-notification-replied'] : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {!notif.has_replied && <div className={style['mentor-notif-dot']}></div>}
                    <div className={style['mentor-notif-content']}>
                      <p className={style['mentor-notif-text']}>
                        {notif.has_replied && <span className={style['mentor-replied-tag']}>[Replied]</span>}
                        New question in <strong>{notif.subject}</strong>: "{notif.topic}"
                      </p>
                      <span className={style['mentor-notif-time']}>
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Connection Requests Section */}
            <div className={style['connection-requests-section']}>
              <h2 className={style['mentor-panel-title']} style={{ marginBottom: '1rem' }}>Incoming Chat Requests</h2>
              <div className={style['connection-requests-list']}>
                {chatRequests.length === 0 ? (
                  <p className={style['mentor-no-notif-text']} style={{ margin: '0.5rem 0' }}>No pending chat requests.</p>
                ) : (
                  chatRequests.map((req) => (
                    <div
                      key={req.request_id}
                      className={style['mentor-request-card']}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-heading, #0f172a)' }}>
                          {req.student_profile?.name || req.student_profile?.user_name || "Student"}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '99px', textTransform: 'uppercase', fontWeight: 700 }}>
                          {req.status}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{req.message}"
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => handleAcceptRequest(req.request_id)}
                          className={style['mentor-accept-btn']}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.request_id)}
                          className={style['mentor-reject-btn']}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Main Tasks & Chat Panel */}
          <section className={style['mentor-tasks-panel']}>
            
            {/* Dashboard Sub-Tabs Bar */}
            <div className={style['dashboard-tabs-bar']}>
              <button
                className={`${style['dashboard-tab-btn']} ${activeTabSection === "tasks" ? style['active'] : ""}`}
                onClick={() => setActiveTabSection("tasks")}
              >
                <Award size={18} />
                <span>Tasks & Assessments</span>
              </button>
              <button
                className={`${style['dashboard-tab-btn']} ${activeTabSection === "chats" ? style['active'] : ""}`}
                onClick={() => {
                  setActiveTabSection("chats");
                  loadConversations();
                }}
              >
                <MessageSquare size={18} />
                <span>Chat Workspace</span>
                {chatRequests.length > 0 && (
                  <span className={style['tab-notif-count']}>{chatRequests.length}</span>
                )}
              </button>
            </div>

            {activeTabSection === "tasks" ? (
              <>
                {/* Pending Tasks Section */}
                <div className={style['mentor-task-section']}>
                  <div className={style['mentor-clean-header']}>
                    <h1 className={style['mentor-panel-title-alt']}>Pending Tasks</h1>
                    <p className={style['mentor-section-subtitle']}>
                      Create assessment materials for the subjects you are an expert in.
                    </p>
                  </div>

                  {pendingSubjects.length === 0 ? (
                    <div className={style['mentor-empty-state']}>
                      <h3 className={style['mentor-empty-title']}>No pending tasks!</h3>
                      <p className={style['mentor-empty-subtitle']}>
                        You have taken tests for all your subjects.
                      </p>
                    </div>
                  ) : (
                    <div className={style['mentor-card-grid']}>
                      {pendingSubjects.map((subjectObj, index) => {
                        const subjectName = subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
                        return (
                          <motion.div
                            key={`pending-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => runGroqGeneration(subjectName)}
                            className={`${style['mentor-card']} ${style['mentor-card--pending']}`}
                          >
                            <div className={style['mentor-card-top']}>
                              <div className={`${style['mentor-card-icon']} ${style['mentor-card-icon--primary']}`}>
                                <svg className={style['mentor-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                              </div>
                              <h3 className={style['mentor-card-title']}>Take Test</h3>
                              <p className={style['mentor-card-subject']}>{subjectName}</p>
                            </div>
                            <div className={style['mentor-card-action']}>
                              Start Task
                              <svg className={style['mentor-card-arrow']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Completed Tests Section */}
                {completedSubjects.length > 0 && (
                  <div className={style['mentor-task-section']}>
                    <div className={style['mentor-clean-header']}>
                      <h2 className={style['mentor-panel-title-alt']}>Completed Tests</h2>
                      <p className={style['mentor-section-subtitle']}>
                        Subjects you have successfully verified.
                      </p>
                    </div>
                    
                    <div className={style['mentor-card-grid']}>
                      {completedSubjects.map((subjectObj, index) => {
                        const subjectName = subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
                        return (
                          <motion.div
                            key={`comp-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`${style['mentor-card']} ${style['mentor-card--completed']}`}
                          >
                            <div className={style['mentor-card-top']}>
                              <div className={`${style['mentor-card-icon']} ${style['mentor-card-icon--emerald']}`}>
                                <svg className={style['mentor-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <h3 className={style['mentor-card-title']}>{subjectName}</h3>
                              <p className={style['mentor-card-score']}>
                                Score: <strong>{subjectObj.marks}</strong> / 15
                              </p>
                            </div>
                            <div>
                              <button onClick={() => handleRetakeTest(subjectObj)} className={style['mentor-retake-btn']}>
                                Retake Test
                                <svg className={style['mentor-icon--sm']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Chat Workspace Pane */
              <div className={style['mentor-chat-workspace']} data-chat-selected={selectedChat ? "true" : "false"}>
                {/* Left Sidebar Pane: Active Chats */}
                <div className={style['mentor-chat-sidebar']}>
                  <h3 className={style['sidebar-title']}>Active Chats</h3>
                  <div className={style['sidebar-list']}>
                    {loadingConversations ? (
                      <p className={style['loading-chats-text']}>Loading active chats...</p>
                    ) : conversations.length === 0 ? (
                      <div className={style['empty-chats-box']}>
                        <MessageCircle size={28} className={style['empty-icon']} />
                        <p>No active conversations yet.</p>
                        <span>Exchanges will appear here once you accept a connection request.</span>
                      </div>
                    ) : (
                      conversations.map((c) => {
                        const isSelected = selectedChat?.chat_id === c.chat_id;
                        return (
                          <div
                            key={c.chat_id}
                            className={`${style['chat-sidebar-card']} ${isSelected ? style['active'] : ''}`}
                            onClick={() => handleSelectChat(c)}
                          >
                            <ChatAvatar
                                imagePath={c.peer_profile?.profile_picture}
                                name={c.peer_profile?.name || "Student"}
                                className={style['chat-card-avatar']}
                                fallbackIcon={userIcon}
                              />
                            <div className={style['chat-card-info']}>
                              <div className={style['chat-card-header']}>
                                <h4 className={style['chat-card-name']}>
                                  {c.peer_profile?.name || c.peer_profile?.user_name || "Student"}
                                </h4>
                                {c.latest_message_time && (
                                  <span className={style['chat-card-time']}>
                                    {new Date(c.latest_message_time).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className={style['chat-card-preview']}>
                                Click to connect in chat
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Area Pane: Active Message Thread */}
                <div className={style['mentor-chat-thread']}>
                  {selectedChat ? (
                    <div className={style['chat-room-container']}>
                      <div className={style['chat-room-header']}>
                        <button className={style['chat-room-back-btn']} onClick={handleDeselectChat}>
                          <ArrowLeft size={18} />
                        </button>
                          <ChatAvatar
                            imagePath={selectedChat.peer_profile?.profile_picture}
                            name={selectedChat.peer_profile?.name || "Student"}
                            className={style['chat-room-avatar']}
                            fallbackIcon={userIcon}
                          />
                        <div className={style['chat-room-header-details']}>
                          <h4 className={style['chat-room-peer-name']}>
                            {selectedChat.peer_profile?.name || selectedChat.peer_profile?.user_name || "Student"}
                          </h4>
                          <span className={style['chat-room-status']}>Connected Chat</span>
                        </div>
                      </div>

                      <div className={style['chat-room-message-list']}>
                        {chatMessages.length === 0 ? (
                          <div className={style['chat-room-empty-msgs']}>
                            <MessageCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                            <p>Send a message to start the conversation!</p>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              This connection will expire 3 days after the last message.
                            </span>
                          </div>
                        ) : (
                          chatMessages.map((msg) => {
                            const isMe = msg.sender_id === userId;
                            return (
                              <div
                                key={msg.message_id}
                                className={`${style['chat-msg-row']} ${isMe ? style['me'] : style['peer']}`}
                              >
                                <div className={`${style['chat-msg-bubble']} ${isMe ? style['me'] : style['peer']}`}>
                                  <p className={style['chat-msg-text']}>{msg.content}</p>
                                  <span className={style['chat-msg-time']}>
                                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <form onSubmit={handleSendDashboardMessage} className={style['chat-room-input-form']}>
                        <input
                          type="text"
                          placeholder="Type a message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          className={style['chat-room-input-field']}
                        />
                        <button type="submit" className={style['chat-room-send-btn']} disabled={!messageInput.trim()}>
                          <Send size={16} />
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className={style['chat-thread-placeholder']}>
                      <MessageSquare size={48} className={style['placeholder-icon']} />
                      <h3>Select a Chat Room</h3>
                      <p>Pick a student conversation from the left sidebar to start messaging in real time.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

        </div>

        {/* Loader Overlays */}
        <AnimatePresence>
          {isGenerating && !testActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={style['mentor-loader-overlay']}
            >
              <div className={style['mentor-loader-box']}>
                <svg className={style['mentor-spinner']} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className={style['mentor-spinner-track']} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className={style['mentor-spinner-fill']} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <h2 className={style['mentor-loader-title']}>Preparing Your Test...</h2>
                <p className={style['mentor-loader-subtitle']}>
                  Generating 15 questions for {activeTask}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Test Modal Overlay */}
      <AnimatePresence>
        {testActive && testData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={style['mentor-modal-overlay']}
          >
            <div className={style['mentor-modal']}>
              {scoreSummary ? (
                <div className={style['mentor-score-summary']}>
                  <div className={style['mentor-score-icon-wrap']}>
                    <svg className={style['mentor-score-check']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className={style['mentor-score-heading']}>Test Completed!</h2>
                  <p className={style['mentor-score-text']}>
                    You scored <span className={style['mentor-score-value']}>{scoreSummary.score}</span> out of {scoreSummary.total}
                  </p>
                  <button onClick={closeTest} className={style['mentor-btn-primary']}>
                    Back to Dashboard
                  </button>
                </div>
              ) : (
                <>
                  <div className={style['mentor-test-header']}>
                    <div>
                      <h2 className={style['mentor-test-title']}>{activeTask} Test</h2>
                      <p className={style['mentor-test-subtitle']}>
                        Answer all 15 questions. Auto-submits on timeout.
                      </p>
                    </div>
                    <div className={style['mentor-timer']}>
                      <svg className={style['mentor-timer-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={style['mentor-timer-value']}>{formatTime(timeLeft)}</span>
                    </div>
                  </div>

                  <div className={style['mentor-questions']}>
                    {testData.questions.map((q, qIndex) => (
                      <div key={qIndex} className={style['mentor-question-card']}>
                        <p className={style['mentor-question-text']}>
                          <span className={style['mentor-question-num']}>{qIndex + 1}.</span>
                          {q.question}
                        </p>
                        <div className={style['mentor-options']}>
                          {q.options.map((opt, oIndex) => (
                            <label
                              key={oIndex}
                              className={`${style['mentor-option']} ${userAnswers[qIndex] === oIndex ? style['mentor-option--selected'] : ""}`}
                            >
                              <div className={style['mentor-option-radio-wrap']}>
                                <input
                                  type="radio"
                                  name={`q-${qIndex}`}
                                  value={oIndex}
                                  checked={userAnswers[qIndex] === oIndex}
                                  onChange={() => setUserAnswers({ ...userAnswers, [qIndex]: oIndex })}
                                  className={style['mentor-radio']}
                                />
                              </div>
                              <div className={style['mentor-option-text']}>
                                <span>{opt}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={style['mentor-test-footer']}>
                    <div className={style['mentor-answer-count']}>
                      Answered: {Object.keys(userAnswers).length} / 15
                    </div>
                    <button onClick={submitTest} className={style['mentor-btn-submit']}>
                      Submit Test
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Interface */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className={style['mentor-toast']}
          >
            <svg className={style['mentor-toast-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={style['mentor-toast-text']}>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
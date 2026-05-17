import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import styles from "./QuestionDetail.module.css";

type Question = {
  question_id: string;
  student_id: string;
  subject: string;
  topic: string;
  teacher_name: string;
  description: string;
  file_upload: string | null;
  uploaded_at: string;
  likes_count: number;
};

type Reply = {
  reply_id: string;
  question_id: string;
  mentor_id: string;
  description: string;
  likes_count: number;
  replied_at: string;
  mentor_name?: string; // We will fetch profile info
};

const QuestionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [question, setQuestion] = useState<Question | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isMentor, setIsMentor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasLikedQuestion, setHasLikedQuestion] = useState(false);
  const [likedReplies, setLikedReplies] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      setCurrentUserId(userId || null);

      if (userId) {
        // Check if user is a mentor
        const { data: mentorData } = await supabase
          .from("mentor")
          .select("mentor_id")
          .eq("mentor_id", userId)
          .maybeSingle();
        if (mentorData) setIsMentor(true);
      }

      if (id) {
        // Fetch Question
        const { data: qData, error: qError } = await supabase
          .from("question")
          .select("*")
          .eq("question_id", id)
          .maybeSingle();

        if (qData) setQuestion(qData);

        // Fetch Replies with Profile Name
        // (Using standard join if foreign keys are set up, otherwise we fetch profiles manually)
        const { data: rData } = await supabase
          .from("reply")
          .select("*")
          .eq("question_id", id)
          .order("replied_at", { ascending: true });

        if (rData) {
          // Fetch profiles for the mentors
          const mentorIds = rData.map((r) => r.mentor_id);
          const { data: profileData } = await supabase
            .from("profile")
            .select("id, user_name")
            .in("id", mentorIds);

          const profileMap: Record<string, string> = {};
          profileData?.forEach((p) => {
            profileMap[p.id] = p.user_name;
          });

          const enrichedReplies = rData.map((r) => ({
            ...r,
            mentor_name: profileMap[r.mentor_id] || "Mentor",
          }));
          setReplies(enrichedReplies);
        }

        // Check if current user liked the question
        if (userId) {
          const { data: likeData } = await supabase
            .from("likes")
            .select("*")
            .eq("user_id", userId)
            .eq("question_id", id)
            .maybeSingle();
          if (likeData) setHasLikedQuestion(true);

          // Check liked replies
          const { data: replyLikes } = await supabase
            .from("likes")
            .select("reply_id")
            .eq("user_id", userId)
            .not("reply_id", "is", null);
          
          if (replyLikes) {
            const lrMap: Record<string, boolean> = {};
            replyLikes.forEach((rl) => {
              if (rl.reply_id) lrMap[rl.reply_id] = true;
            });
            setLikedReplies(lrMap);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [id]);

  const handleLikeQuestion = async () => {
    if (!currentUserId || !question || hasLikedQuestion) return;
    
    // Optimistic UI
    setHasLikedQuestion(true);
    setQuestion({ ...question, likes_count: (question.likes_count || 0) + 1 });

    const { error } = await supabase.from("likes").insert({
      user_id: currentUserId,
      question_id: question.question_id,
    });

    if (!error) {
      await supabase
        .from("question")
        .update({ likes_count: (question.likes_count || 0) + 1 })
        .eq("question_id", question.question_id);
    }
  };

  const handleLikeReply = async (reply_id: string, currentLikes: number) => {
    if (!currentUserId || likedReplies[reply_id]) return;

    // Optimistic UI
    setLikedReplies({ ...likedReplies, [reply_id]: true });
    setReplies((prev) =>
      prev.map((r) =>
        r.reply_id === reply_id ? { ...r, likes_count: (r.likes_count || 0) + 1 } : r
      )
    );

    const { error } = await supabase.from("likes").insert({
      user_id: currentUserId,
      reply_id: reply_id,
    });

    if (!error) {
      await supabase
        .from("reply")
        .update({ likes_count: currentLikes + 1 })
        .eq("reply_id", reply_id);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !id || !currentUserId) return;
    setIsSubmitting(true);

    const newReply = {
      question_id: id,
      mentor_id: currentUserId,
      description: replyText,
    };

    const { data, error } = await supabase
      .from("reply")
      .insert(newReply)
      .select()
      .single();

    if (error) {
      console.error("Error submitting reply:", error.message);
      console.error("Failed to submit reply");
    } else if (data) {
      // Create notification for the student
      if (question) {
        await supabase.from("notification").insert({
          recipient_id: question.student_id,
          sender_id: currentUserId,
          question_id: id,
          reply_id: data.reply_id,
          type: "new_reply"
        });
      }

      // Refresh replies
      const profileData = await supabase.from("profile").select("user_name").eq("id", currentUserId).single();
      const addedReply = {
        ...data,
        mentor_name: profileData.data?.user_name || "Mentor"
      };
      setReplies([...replies, addedReply]);
      setReplyText("");
    }
    setIsSubmitting(false);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const isImage = (url: string) => /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);

  if (loading) {
    return <div className={styles.pageContainer}>Loading...</div>;
  }

  if (!question) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.contentWrapper}>
          <h2>Question not found</h2>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          &larr; Back
        </button>

        <div className={styles.questionSection}>
          <span className={styles.subjectBadge}>{question.subject}</span>
          <h1 className={styles.topic}>{question.topic}</h1>
          <p className={styles.description}>{question.description}</p>
          
          {question.file_upload && (
            <div className={styles.attachmentSection}>
              {isImage(question.file_upload) ? (
                <img src={question.file_upload} alt="Attachment" className={styles.attachmentImage} />
              ) : (
                <a href={question.file_upload} target="_blank" rel="noreferrer" style={{color: '#10b981'}}>
                  View Attachment Document
                </a>
              )}
            </div>
          )}

          <div className={styles.metaRow}>
            <div className={styles.teacherInfo}>
              <div className={styles.avatar}>{question.teacher_name.charAt(0)}</div>
              <div>
                <span style={{ display: "block", fontWeight: 600, color: "#fff" }}>
                  Prof. {question.teacher_name}
                </span>
                <span>{formatDate(question.uploaded_at)}</span>
              </div>
            </div>
            
            <div className={styles.actions}>
              <button 
                className={`${styles.actionBtn} ${hasLikedQuestion ? styles.liked : ""}`}
                onClick={handleLikeQuestion}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                {question.likes_count || 0}
              </button>
            </div>
          </div>
        </div>

        {/* REPLIES SECTION */}
        <div className={styles.repliesSection}>
          <h2 className={styles.repliesHeader}>Replies ({replies.length})</h2>
          
          {replies.map((reply) => (
            <div key={reply.reply_id} className={styles.replyCard}>
              <div className={styles.replyMeta}>
                <div className={styles.avatar} style={{ width: 24, height: 24, fontSize: '0.8rem' }}>
                  {reply.mentor_name?.charAt(0) || "M"}
                </div>
                <div>
                  <span className={styles.replyAuthor}>{reply.mentor_name}</span>
                  <span className={styles.replyDate}> &bull; {formatDate(reply.replied_at)}</span>
                </div>
              </div>
              <p className={styles.replyText}>{reply.description}</p>
              
              <div className={styles.actions} style={{ marginTop: 8 }}>
                <button 
                  className={`${styles.actionBtn} ${likedReplies[reply.reply_id] ? styles.liked : ""}`}
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  onClick={() => handleLikeReply(reply.reply_id, reply.likes_count || 0)}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  {reply.likes_count || 0}
                </button>
              </div>
            </div>
          ))}

          {isMentor && (
            <div className={styles.replyForm}>
              <textarea 
                className={styles.replyInput}
                placeholder="Write your answer..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button 
                className={styles.submitReplyBtn} 
                onClick={handleSubmitReply}
                disabled={isSubmitting || !replyText.trim()}
              >
                {isSubmitting ? "Posting..." : "Post Reply"}
              </button>
            </div>
          )}
          {!isMentor && replies.length === 0 && (
             <p style={{ color: '#888', fontStyle: 'italic' }}>No mentors have replied yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionDetail;

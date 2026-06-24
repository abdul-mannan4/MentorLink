import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Award, MessageSquare, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../supabase-client";
import userIcon from "../../assets/userIcon.svg";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import style from "./MentorProfile.module.css";

type ProfileData = {
  id: string;
  user_name?: string;
  name?: string;
  profile_picture?: string;
  university_name?: string;
  department?: string;
  technology?: string;
  batch?: string;
};

type MentorData = {
  mentor_id: string;
  id?: string;
  Description?: string;
  rating?: number;
  no_of_replies?: number;
};

const MentorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [mentor, setMentor] = useState<MentorData | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [replyCount, setReplyCount] = useState<number>(0);
  const [mentorRank, setMentorRank] = useState<{ current_rank: number; points: number; total_replies: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setCurrentUserId(data.user.id);
        const { data: reqs } = await supabase
          .from("chat_request")
          .select("status")
          .eq("student_id", data.user.id)
          .eq("mentor_id", id);
        if (reqs && reqs.length > 0) {
          const active = reqs.find((r: { status: string }) => r.status === "pending" || r.status === "accepted" || r.status === "rejected");
          if (active) {
            setRequestStatus(active.status);
          }
        }
      }
    };
    getUserId();
  }, [id]);

  const handleRequestChat = async () => {
    if (!id || !currentUserId) return;
    try {
      const { sendChatRequest } = await import("../../utils/chat-api");
      const res = await sendChatRequest(id, undefined, "Hi! I would love to connect and chat about mentoring.");
      if (res.error) {
        const errorMsg = typeof res.error === "object" ? (res.error as { message: string }).message : res.error;
        showToast("error", errorMsg || "Failed to send chat request");
      } else {
        setRequestStatus("pending");
        showToast("success", "Chat request sent successfully!");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast("error", errMsg || "Error sending chat request");
    }
  };

  useEffect(() => {
    const loadMentor = async () => {
      if (!id) {
        setError("Invalid mentor selected.");
        setLoading(false);
        return;
      }

      try {
        const [profileResult, mentorResult, subjectResult, globalMentors] = await Promise.all([
          supabase
            .from("profile")
            .select("id, user_name, name, profile_picture, university_name, department, technology, batch")
            .eq("id", id)
            .single(),
          supabase
            .from("mentor")
            .select("mentor_id, Description, rating, no_of_replies")
            .eq("mentor_id", id)
            .maybeSingle(),
          supabase
            .from("mentor_subjects")
            .select("course_name, marks")
            .eq("mentor_id", id),
          supabase
            .from("mentor")
            .select("mentor_id")
        ]);

        if (profileResult.error) {
          setError("Mentor profile not found.");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data || null);
        setMentor(mentorResult.data || null);
        
        const subjRows = subjectResult.data || [];
        setSubjects(subjRows.map((s: { course_name: string }) => s.course_name).filter(Boolean));

        const { count: exactReplies } = await supabase
          .from("reply")
          .select("reply_id", { count: "exact", head: true })
          .eq("mentor_id", id);

        const totalReplies = exactReplies ?? 0;
        setReplyCount(totalReplies);

        const globalMentorsData = globalMentors.data || [];
        if (globalMentorsData.length > 0) {
          const mentorUserIds = globalMentorsData.map(m => m.mentor_id).filter(Boolean);

          const [{ data: allReplies }, { data: allSubjects }] = await Promise.all([
            supabase.from("reply").select("mentor_id").in("mentor_id", mentorUserIds),
            supabase.from("mentor_subjects").select("mentor_id, marks").in("mentor_id", mentorUserIds)
          ]);

          const rMap: Record<string, number> = {};
          allReplies?.forEach(r => { if(r.mentor_id) rMap[r.mentor_id] = (rMap[r.mentor_id] || 0) + 1; });

          const sMap: Record<string, { total: number; count: number }> = {};
          allSubjects?.forEach(s => {
            if(!s.mentor_id || s.marks < 0) return;
            const current = sMap[s.mentor_id] || { total: 0, count: 0 };
            current.total += s.marks;
            current.count += 1;
            sMap[s.mentor_id] = current;
          });

          const scoreboard = mentorUserIds.map(mId => {
            const mReplies = rMap[mId] || 0;
            const sData = sMap[mId];
            const mAvg = sData && sData.count > 0 ? sData.total / sData.count : 0;
            const mPoints = (mAvg * 8) + (mReplies * 4) + (Math.log1p(mReplies) * 5);
            return { id: mId, score: mPoints };
          });

          scoreboard.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
          const activePoints = scoreboard.find(item => item.id === id)?.score || 0;
          const matchIdx = scoreboard.findIndex(item => item.id === id);
          const derivedRank = matchIdx !== -1 ? matchIdx + 1 : scoreboard.length + 1;

          setMentorRank({
            current_rank: derivedRank,
            points: Math.round(activePoints),
            total_replies: totalReplies
          });
        }
      } catch (fetchError) {
        console.error(fetchError);
        setError("Unable to load mentor details at this time.");
      } finally {
        setLoading(false);
      }
    };

    loadMentor();
  }, [id]);

  const handleOpenChatWindow = () => {
    if (!id) return;
    window.dispatchEvent(new CustomEvent("open-chat", { detail: { peerId: id } }));
  };

  const signedProfileUrl = useSignedImage(profile?.profile_picture ?? "");
  const rankValue = mentorRank?.current_rank ?? 0;
  const rankPoints = mentorRank?.points ?? 0;

  return (
    <div className={style.profileRoot}>
      <div className={style.profileHeaderBar}>
        <button type="button" className={style.backButton} onClick={() => navigate(-1)}>
          &larr; Back to mentors
        </button>
        <Link to="/student" className={style.homeLink}>Browse mentors</Link>
      </div>

      {loading ? (
        <div className={style.loadingState}>Loading mentor profile...</div>
      ) : error ? (
        <div className={style.errorCard}>{error}</div>
      ) : (
        <div className={style.profileCard}>
          <div className={style.profileTop}>
            <div className={style.avatarCol}>
              <img
                src={signedProfileUrl || profile?.profile_picture || userIcon}
                alt={profile?.user_name || profile?.name || "Mentor"}
                className={style.profileImage}
              />
              {currentUserId && currentUserId !== id && (
                <div className={style.avatarActionWrap}>
                  {requestStatus === "pending" ? (
                    <button className={style.requestChatBtnDisabled} disabled>
                      <Send size={16} /> Waiting...
                    </button>
                  ) : requestStatus === "accepted" ? (
                    <button className={style.requestChatBtnSuccess} onClick={handleOpenChatWindow}>
                      <MessageSquare size={16} /> Chat Now
                    </button>
                  ) : (
                    <button className={style.requestChatBtn} onClick={handleRequestChat}>
                      <MessageSquare size={16} /> Connect Chat
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={style.profileSummary}>
              <div className={style.profileTitleRow}>
                <div>
                  <p className={style.profileRole}>Top Mentor</p>
                  <h1 className={style.profileName}>
                    {profile?.user_name || profile?.name || "Mentor"}
                  </h1>
                </div>

                <div className={style.profileStatsRow}>
                  <span className={style.rankBadge}>
                    <Award size={16} className={style.rankIcon} />
                    {rankValue > 0 ? `Rank #${rankValue}` : "Unranked"}
                  </span>
                  <span className={style.statSeparator}>&bull;</span>
                  <span className={style.statLabel}>Replies:</span>
                  <strong className={style.statValue}>{replyCount}</strong>
                </div>
              </div>


              {mentor?.Description && mentor.Description.trim() && (
                <p className={style.profileAbout}>
                  {mentor.Description}
                </p>
              )}

              <div className={style.statsGrid}>
                <div className={style.statCard}>
                  <span className={style.statLabel}>Rank</span>
                  <strong className={style.statValue}>{rankValue > 0 ? `#${rankValue}` : "—"}</strong>
                </div>
                <div className={style.statCard}>
                  <span className={style.statLabel}>Rank Points</span>
                  <strong className={style.statValue}>{rankPoints}</strong>
                </div>
                <div className={style.statCard}>
                  <span className={style.statLabel}>Expert Subjects</span>
                  <strong className={style.statValue}>{subjects.length || 0}</strong>
                </div>
                {profile?.university_name && (
                  <div className={style.statCard}>
                    <span className={style.statLabel}>University</span>
                    <strong className={style.statValue}>{profile.university_name}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mentor?.Description && mentor.Description.trim() && (
            <section className={style.aboutSection}>
              <h2>About this mentor</h2>
              <p>{mentor.Description}</p>
            </section>
          )}

          <section className={style.expertiseSection}>
            <div className={style.sectionHeadingRow}>
              <h2>Expertise</h2>
              <span>{subjects.length} subjects</span>
            </div>
            <div className={style.chipList}>
              {subjects.length > 0 ? (
                subjects.map((subject) => (
                  <span key={subject} className={style.chip}>{subject}</span>
                ))
              ) : (
                <span className={style.emptyText}>No expertise subjects listed yet.</span>
              )}
            </div>
          </section>
        </div>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${style.toast} ${toast.type === "success" ? style.toastSuccess : style.toastError}`}
            initial={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
          >
            <span className={style.toastIcon}>{toast.type === "success" ? "✓" : "⚠"}</span>
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentorProfile;

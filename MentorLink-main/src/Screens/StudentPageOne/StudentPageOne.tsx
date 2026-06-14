import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCache, setCache } from "../../utils/cache";
import { Bell, ChevronDown, ArrowLeft, X, Search } from "lucide-react";
import ModeButton from "../../components/ModeButton/ModeButton";
import styles from "./StudentPageOne.module.css";
import userIcon from "../../assets/userIcon.svg";
import searchIcon from "../../assets/searchIcon.svg";
import { supabase } from "../../supabase-client";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import MentorCard from "../../components/MentorCard/MentorCard";
import QuestionForm from "../../components/QuestionForm/QuestionForm";
import QuestionCard from "../../components/QuestionCard/QuestionCard";

type Profile = {
  name: string;
  user_name: string;
  profile_picture: string;
  university_email: string;
  university_name: string;
  department: string;
  technology: string;
  batch: string;
};

type Question = {
  question_id: string;
  student_id: string;
  subject: string;
  topic: string;
  teacher_name: string;
  description: string;
  file_upload: string | null;
  uploaded_at: string;
};

type Notification = {
  notification_id: string;
  question_id: string;
  is_read: boolean;
  created_at: string;
  topic?: string;
};

type Mentor = {
  mentor_id: string;
  name?: string;
  user_name: string;
  profile_picture?: string | null;
  university_name?: string | null;
  department?: string | null;
  Description?: string | null;
  rank?: number | null;
  total_replies?: number | null;
  average_score?: number | null;
  ranking_score?: number | null;
};

type MentorSuggestionRowProps = {
  mentor: Mentor;
  onClick: () => void;
};

const MentorSuggestionRow = ({ mentor, onClick }: MentorSuggestionRowProps) => {
  const signedUrl = useSignedImage(mentor.profile_picture || null);
  const avatar = signedUrl || userIcon;
  return (
    <div
      className={styles.mobileSuggestionCard}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className={styles.suggestionCardHeader}>
        <span className={`${styles.suggestionBadge} ${styles.mentorBadge}`}>Mentor</span>
        {mentor.rank ? (
          <span className={styles.suggestionRank}>Rank #{mentor.rank}</span>
        ) : null}
      </div>
      <div className={styles.mentorRowBody}>
        <img
          src={avatar}
          alt={mentor.name || mentor.user_name}
          className={styles.mentorSuggestionAvatar}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = userIcon;
          }}
        />
        <div className={styles.mentorRowInfo}>
          <h5 className={styles.suggestionTopic}>{mentor.name || mentor.user_name}</h5>
          <span className={styles.suggestionSubject}>
            {mentor.university_name || mentor.department || "Independent Mentor"}
          </span>
          <p className={styles.suggestionDesc}>{mentor.Description}</p>
        </div>
      </div>
      <div className={styles.suggestionMeta}>
        {mentor.total_replies !== undefined && <span>{mentor.total_replies} replies</span>}
        {typeof mentor.average_score === "number" && mentor.average_score > 0 && (
          <>
            <span>•</span>
            <span>Score: {mentor.average_score.toFixed(1)}</span>
          </>
        )}
      </div>
    </div>
  );
};

const StudentPageOne = () => {
  const navigate = useNavigate();
  const projectName = "MentroLink";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchContent, setSearchContent] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  const [matchedQuestions, setMatchedQuestions] = useState<Question[]>([]);
  const [allMatchedQuestions, setAllMatchedQuestions] = useState<Question[]>([]);
  const [matchedVisibleCount, setMatchedVisibleCount] = useState(4);

  const [unmatchedQuestions, setUnmatchedQuestions] = useState<Question[]>([]);
  const [allUnmatchedQuestions, setAllUnmatchedQuestions] = useState<Question[]>([]);
  const [unmatchedVisibleCount, setUnmatchedVisibleCount] = useState(4);

  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [showAllMentors, setShowAllMentors] = useState(false);

  const signedProfileUrl = useSignedImage(profile?.profile_picture ?? "");

  const [activeMode, setActiveMode] = useState<string | null>(null);

  useEffect(() => {
    const mode = sessionStorage.getItem("activeMode");
    if (mode === "mentor") {
      navigate("/mentor-dashboard", { replace: true });
    } else {
      if (!mode) {
        sessionStorage.setItem("activeMode", "student");
      }
      setActiveMode("student");
    }
  }, [navigate]);

  const handleSwitchToMentor = () => {
    if (isMentor) {
      sessionStorage.setItem("activeMode", "mentor");
      navigate("/mentor-dashboard", { replace: true });
    } else {
      navigate("/mentor-profile", { replace: true });
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const cached = getCache("profile");
      if (cached) {
        setProfile(cached);
        return;
      }
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) {
        navigate("/", { replace: true });
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profile")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || !data) {
        navigate("/profile", { replace: true });
        return;
      }
      setProfile(data);
      setCache("profile", data);
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const fetchMentorStatus = async () => {
      const cached = getCache("isMentor");
      if (typeof cached === "boolean") {
        setIsMentor(cached);
        return;
      }
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) return;

      const { data } = await supabase
        .from("mentor")
        .select("mentor_id")
        .eq("mentor_id", authData.user.id)
        .maybeSingle();

      const exists = !!data;
      setIsMentor(exists);
      setCache("isMentor", exists);
    };
    fetchMentorStatus();
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      const cachedQuestions = getCache("questions");
      const cachedSubjects = getCache("studentSubjects");
      if (cachedQuestions && cachedSubjects) {
        const studentSubjectsSet = new Set(cachedSubjects);
        const matched: Question[] = [];
        const unmatched: Question[] = [];

        cachedQuestions.forEach((q) => {
          if (studentSubjectsSet.has(q.subject)) {
            matched.push(q);
          } else {
            unmatched.push(q);
          }
        });

        setAllMatchedQuestions(matched);
        setMatchedQuestions(matched);
        setAllUnmatchedQuestions(unmatched);
        setUnmatchedQuestions(unmatched);
        return;
      }

      setQuestionsLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setQuestionsLoading(false);
        return;
      }

      const { data: subjectData } = await supabase
        .from("student_subjects")
        .select("course_name")
        .eq("student_id", authData.user.id);

      const subjectNames = subjectData ? subjectData.map((s) => s.course_name) : [];
      const studentSubjectsSet = new Set(subjectNames);

      const { data: questionData, error: questionError } = await supabase
        .from("question")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (questionError) {
        setQuestionsLoading(false);
        return;
      }

      const allFetchedQuestions = questionData || [];
      const matched: Question[] = [];
      const unmatched: Question[] = [];

      allFetchedQuestions.forEach((q) => {
        if (studentSubjectsSet.has(q.subject)) {
          matched.push(q);
        } else {
          unmatched.push(q);
        }
      });

      setCache("questions", allFetchedQuestions);
      setCache("studentSubjects", subjectNames);

      setAllMatchedQuestions(matched);
      setMatchedQuestions(matched);
      setAllUnmatchedQuestions(unmatched);
      setUnmatchedQuestions(unmatched);
      setQuestionsLoading(false);
    };

    fetchQuestions();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      const cached = getCache("notifications");
      if (cached) {
        setNotifications(cached);
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data: notifData } = await supabase
        .from("notification")
        .select("*")
        .eq("recipient_id", authData.user.id)
        .eq("type", "new_reply")
        .order("is_read", { ascending: true })
        .order("created_at", { ascending: false });

      if (notifData && notifData.length > 0) {
        const questionIds = notifData.map((n) => n.question_id).filter(Boolean);
        let questionsMap: Record<string, string> = {};

        if (questionIds.length > 0) {
          const { data: qData } = await supabase
            .from("question")
            .select("question_id, topic")
            .in("question_id", questionIds);

          if (qData) {
            qData.forEach((q) => {
              questionsMap[q.question_id] = q.topic;
            });
          }
        }

        const formatted = notifData.map((n: any) => ({
          ...n,
          topic: questionsMap[n.question_id] || "Your Question",
        }));
        setNotifications(formatted);
        setCache("notifications", formatted);
      }
    };
    fetchNotifications();
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    navigate(`/question/${notif.question_id}`);
    if (notif.is_read) return;

    const { error } = await supabase
      .from("notification")
      .update({ is_read: true })
      .eq("notification_id", notif.notification_id);

    if (!error) {
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.notification_id === notif.notification_id ? { ...n, is_read: true } : n
        );
        setCache("notifications", updated);
        return updated;
      });
    }
  };

  useEffect(() => {
    const fetchTopMentors = async () => {
      const cached = getCache("topMentors");
      if (cached) {
        setMentors(cached);
        return;
      }
      setMentorsLoading(true);
      try {
        const { data: mentorRows, error: mentorError } = await supabase
          .from("mentor")
          .select("mentor_id, Description");

        if (mentorError) return;
        const mentorIds = (mentorRows || []).map((m: any) => m.mentor_id).filter(Boolean);

        if (mentorIds.length === 0) {
          setMentors([]);
          return;
        }

        const [{ data: profileRows }, { data: allReplies }, { data: allSubjects }] = await Promise.all([
          supabase.from("profile").select("id, name, user_name, profile_picture, university_name, department").in("id", mentorIds),
          supabase.from("reply").select("mentor_id").in("mentor_id", mentorIds),
          supabase.from("mentor_subjects").select("mentor_id, marks").in("mentor_id", mentorIds),
        ]);

        const profileMap = (profileRows || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const rMap: Record<string, number> = {};
        allReplies?.forEach(r => { if (r.mentor_id) rMap[r.mentor_id] = (rMap[r.mentor_id] || 0) + 1; });

        const sMap: Record<string, { total: number; count: number }> = {};
        allSubjects?.forEach(s => {
          if (!s.mentor_id || s.marks < 0) return;
          const current = sMap[s.mentor_id] || { total: 0, count: 0 };
          current.total += s.marks;
          current.count += 1;
          sMap[s.mentor_id] = current;
        });

        const scoreboard = mentorIds.map(id => {
          const mReplies = rMap[id] || 0;
          const sData = sMap[id];
          const mAvg = sData && sData.count > 0 ? sData.total / sData.count : 0;
          const mPoints = (mAvg * 8) + (mReplies * 4) + (Math.log1p(mReplies) * 5);
          return { id, score: mPoints, avg: mAvg, replies: mReplies };
        });

        scoreboard.sort((a, b) => b.score - a.score);

        const mentorList = (mentorRows || []).map((mentor: any) => {
          const pInfo = profileMap[mentor.mentor_id] || {};
          const matchedScore = scoreboard.find(item => item.id === mentor.mentor_id);
          const matchIdx = scoreboard.findIndex(item => item.id === mentor.mentor_id);

          return {
            mentor_id: mentor.mentor_id,
            name: pInfo.name || pInfo.user_name || "Mentor",
            user_name: pInfo.user_name || "Mentor",
            profile_picture: pInfo.profile_picture || null,
            university_name: pInfo.university_name || null,
            department: pInfo.department || null,
            Description: mentor.Description || "No description yet.",
            rank: matchIdx !== -1 ? matchIdx + 1 : scoreboard.length + 1,
            total_replies: matchedScore ? matchedScore.replies : 0,
            average_score: matchedScore ? matchedScore.avg : 0,
          } as Mentor;
        });

        mentorList.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
        setMentors(mentorList);
        setCache("topMentors", mentorList);
      } catch (error) {
        console.error("Unable to fetch top mentors", error);
      } finally {
        setMentorsLoading(false);
      }
    };

    fetchTopMentors();
  }, []);

  useEffect(() => {
    if (!searchContent.trim()) {
      setMatchedQuestions(allMatchedQuestions);
      setUnmatchedQuestions(allUnmatchedQuestions);
      return;
    }

    const lower = searchContent.toLowerCase();
    const filterFn = (q: Question) =>
      q.subject.toLowerCase().includes(lower) ||
      q.topic.toLowerCase().includes(lower) ||
      q.teacher_name.toLowerCase().includes(lower) ||
      q.description.toLowerCase().includes(lower);

    setMatchedQuestions(allMatchedQuestions.filter(filterFn));
    setMatchedVisibleCount(4);
    setUnmatchedQuestions(allUnmatchedQuestions.filter(filterFn));
    setUnmatchedVisibleCount(4);
  }, [searchContent, allMatchedQuestions, allUnmatchedQuestions]);

  const filteredMentors = (() => {
    if (!searchContent.trim()) return mentors;
    const query = searchContent.toLowerCase();
    return mentors.filter(m =>
      (m.name || "").toLowerCase().includes(query) ||
      (m.user_name || "").toLowerCase().includes(query) ||
      (m.Description || "").toLowerCase().includes(query) ||
      (m.university_name || "").toLowerCase().includes(query) ||
      (m.department || "").toLowerCase().includes(query)
    );
  })();

  const questionSuggestions = (() => {
    if (!searchContent.trim()) return [];
    const query = searchContent.toLowerCase();
    const allQs = [...allMatchedQuestions, ...allUnmatchedQuestions];
    const seen = new Set<string>();
    const uniqueQs: Question[] = [];
    for (const q of allQs) {
      if (!seen.has(q.question_id)) {
        seen.add(q.question_id);
        uniqueQs.push(q);
      }
    }
    return uniqueQs.filter(q =>
      (q.subject || "").toLowerCase().includes(query) ||
      (q.topic || "").toLowerCase().includes(query) ||
      (q.teacher_name || "").toLowerCase().includes(query) ||
      (q.description || "").toLowerCase().includes(query)
    ).slice(0, 3);
  })();

  const mentorSuggestions = (() => {
    if (!searchContent.trim()) return [];
    const query = searchContent.toLowerCase();
    return mentors.filter(m =>
      (m.name || "").toLowerCase().includes(query) ||
      (m.user_name || "").toLowerCase().includes(query) ||
      (m.Description || "").toLowerCase().includes(query) ||
      (m.university_name || "").toLowerCase().includes(query) ||
      (m.department || "").toLowerCase().includes(query)
    ).slice(0, 3);
  })();

  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.is_read !== b.is_read) {
      return a.is_read ? 1 : -1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (activeMode !== "student") {
    return null;
  }

  return (
    <div className={styles.TopContainer}>
      <QuestionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
      <nav className={styles.LandingNavbar}>
        <div className={styles.leftSide}>
          <div className={styles.logo}>
            <span className={styles.dot}></span>
            <span className={styles.logoName}>{projectName[0]}<span className={styles["logo-text-rest"]}>{projectName.slice(1)}</span></span>
          </div>
          <button className={styles.askQuestionButton} onClick={() => setIsFormOpen(true)}>Ask Question</button>
        </div>

        <div className={styles.navActions}>
          {/* Desktop Search Bar */}
          <div className={styles.searchBarContainer}>
            <input
              type="text"
              placeholder="Search by subject, topic, teacher..."
              value={searchContent}
              onChange={(e) => setSearchContent(e.target.value)}
              className={styles.searchBar}
            />
            <img src={searchIcon} alt="Search" className={styles.searchIcon} />
          </div>

          {/* Mobile Search Trigger Button */}
          <button
            className={styles.mobileSearchTrigger}
            onClick={() => setIsMobileSearchActive(true)}
            aria-label="Search"
          >
            <Search className={styles.mobileSearchIcon} size={20} />
          </button>

          <div className={styles.notificationWrapper}>
            <div className={styles.bellIconContainer} onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className={styles.bellIcon} />
              {notifications.some((n) => !n.is_read) && <span className={styles.notificationBadge}></span>}
            </div>

            {showNotifications && (
              <>
                <div className={styles.notificationBackdrop} onClick={() => setShowNotifications(false)} />
                <div className={styles.notificationDropdown}>
                  <h4 className={styles.notificationHeader}>Notifications</h4>
                  {notifications.length === 0 ? (
                    <p className={styles.noNotifications}>No new notifications.</p>
                  ) : (
                    <>
                      <div className={styles.notificationList}>
                        {(showAllNotifications ? sortedNotifications : sortedNotifications.slice(0, 5)).map((notif) => (
                          <div key={notif.notification_id} className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ""}`} onClick={() => handleNotificationClick(notif)}>
                            <div className={styles.notifDot}></div>
                            <div className={styles.notifContent}>
                              <p>New reply on: <strong>{notif.topic}</strong></p>
                              <span>{new Date(notif.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {notifications.length > 5 && !showAllNotifications && (
                        <button className={styles.viewMoreBtn} onClick={() => setShowAllNotifications(true)}><ChevronDown size={16} /> View More</button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.modeButton}><ModeButton /></div>
          <button className={styles.mentorOptionButton} onClick={handleSwitchToMentor}>{isMentor ? "Switch to Mentor" : "Continue as Mentor"}</button>
          <div className={styles.profileSideBar}>{!open && <img src={signedProfileUrl || userIcon} alt="Profile" className={styles.profilePic} onClick={() => setOpen(true)} />}</div>

          {open && (
            <div className={styles.overlay} onClick={() => { setOpen(false); }}>
              <div className={styles.sideBar} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sideBarContent}>
                  <div className={styles.sideBarHeader}>
                    <img src={signedProfileUrl || userIcon} alt="Profile" className={styles.profilePicInSidebar} />
                    <p className={styles.userName}>{profile?.user_name || "User"}</p>
                  </div>
                  <button className={`${styles.mentorOptionButton} ${styles.mentorOptionButtonSide}`} onClick={() => { setOpen(false); handleSwitchToMentor(); }}>{isMentor ? "Switch to Mentor" : "Continue as Mentor"}</button>
                  <div className={styles.modeButtonSide}><span>Change Mode</span><ModeButton /></div>
                  <div className={styles.menuItems}>
                    <button className={styles.profileEditButton} onClick={() => { setOpen(false); navigate("/student-dashboard", { replace: true }); }}>Dashboard</button>
                    <button className={styles.profileEditButton} onClick={() => { setOpen(false); navigate("/profile", { replace: true }); }}>My Profile</button>
                    <button className={styles.profileEditButton} onClick={async () => { sessionStorage.removeItem("activeMode"); await supabase.auth.signOut(); navigate("/", { replace: true }); }}>Logout</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className={styles.body}>
        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}><h3 className={styles.sectionTitle}>Questions for Your Subjects</h3></div>
          {questionsLoading ? <p className={styles.loadingText}>Loading questions...</p> : matchedQuestions.length === 0 ? <p className={styles.emptyText}>No questions match your search in your subjects.</p> : (
            <>
              <div className={styles.questionsList}>
                {matchedQuestions.slice(0, matchedVisibleCount).map((q) => <QuestionCard key={q.question_id} id={q.question_id} subject={q.subject} topic={q.topic} description={q.description} teacherName={q.teacher_name} uploadedAt={q.uploaded_at} fileUpload={q.file_upload} />)}
              </div>
              {matchedVisibleCount < matchedQuestions.length && <div className={styles.loadMoreContainer}><button className={styles.loadMoreBtn} onClick={() => setMatchedVisibleCount((p) => p + 4)}>See More Questions</button></div>}
            </>
          )}
        </div>

        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}><h3 className={styles.sectionTitle}>Other Questions</h3></div>
          {questionsLoading ? <p className={styles.loadingText}>Loading questions...</p> : unmatchedQuestions.length === 0 ? <p className={styles.emptyText}>No other questions found.</p> : (
            <>
              <div className={styles.questionsList}>
                {unmatchedQuestions.slice(0, unmatchedVisibleCount).map((q) => <QuestionCard key={q.question_id} id={q.question_id} subject={q.subject} topic={q.topic} description={q.description} teacherName={q.teacher_name} uploadedAt={q.uploaded_at} fileUpload={q.file_upload} />)}
              </div>
              {unmatchedVisibleCount < unmatchedQuestions.length && <div className={styles.loadMoreContainer}><button className={styles.loadMoreBtn} onClick={() => setUnmatchedVisibleCount((p) => p + 4)}>See More Questions</button></div>}
            </>
          )}
        </div>

        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}><h3 className={styles.sectionTitle}>Top Mentors</h3></div>
          {mentorsLoading ? <p className={styles.loadingText}>Loading mentors...</p> : filteredMentors.length === 0 ? <p className={styles.emptyText}>No mentors match your search.</p> : (
            <>
              <div className={styles.mentorCardGrid}>
                {(showAllMentors ? filteredMentors : filteredMentors.slice(0, 3)).map((mentor) => (
                  <MentorCard key={mentor.mentor_id} mentorId={mentor.mentor_id} image={mentor.profile_picture || undefined} userName={mentor.name || mentor.user_name} Description={mentor.Description || "No description available."} rank={mentor.rank ?? 0} reviews={mentor.total_replies ?? 0} score={mentor.average_score ?? null} />
                ))}
              </div>
              {filteredMentors.length > 3 && <div className={styles.loadMoreContainer}><button className={styles.loadMoreBtn} onClick={() => setShowAllMentors(!showAllMentors)}>{showAllMentors ? "Show Less" : "See More Mentors"}</button></div>}
            </>
          )}
        </div>
      </div>


      {/* Mobile Search Overlay */}
      {isMobileSearchActive && (
        <div className={styles.mobileSearchOverlay}>
          <div className={styles.mobileSearchHeader}>
            <button
              className={styles.mobileSearchCloseBtn}
              onClick={() => setIsMobileSearchActive(false)}
              aria-label="Close search"
            >
              <ArrowLeft size={24} />
            </button>
            <div className={styles.mobileSearchInputWrapper}>
              <input
                type="text"
                placeholder="Search subject, topic, teacher..."
                value={searchContent}
                onChange={(e) => setSearchContent(e.target.value)}
                className={styles.mobileSearchInput}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsMobileSearchActive(false);
                  }
                }}
              />
              {searchContent && (
                <button
                  className={styles.mobileSearchClearBtn}
                  onClick={() => setSearchContent("")}
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          <div className={styles.mobileSearchResults}>
            {searchContent.trim() ? (
              <div className={styles.mobileSuggestionsList}>
                {questionSuggestions.length === 0 && mentorSuggestions.length === 0 ? (
                  <div className={styles.mobileNoResults}>
                    No results found for "{searchContent}"
                  </div>
                ) : (
                  <>
                    {questionSuggestions.length > 0 && (
                      <div className={styles.suggestionSection}>
                        <h4 className={styles.suggestionSectionHeader}>Questions</h4>
                        <div className={styles.suggestionCardsGrid}>
                          {questionSuggestions.map((item) => (
                            <div
                              key={item.question_id}
                              className={styles.mobileSuggestionCard}
                              onClick={() => {
                                navigate(`/question/${item.question_id}`);
                                setIsMobileSearchActive(false);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  navigate(`/question/${item.question_id}`);
                                  setIsMobileSearchActive(false);
                                }
                              }}
                            >
                              <div className={styles.suggestionCardHeader}>
                                <span className={styles.suggestionBadge}>Question</span>
                                <span className={styles.suggestionSubject}>{item.subject}</span>
                              </div>
                              <h5 className={styles.suggestionTopic}>{item.topic}</h5>
                              <p className={styles.suggestionDesc}>{item.description}</p>
                              <div className={styles.suggestionMeta}>
                                <span>Teacher: {item.teacher_name}</span>
                                <span>•</span>
                                <span>{new Date(item.uploaded_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mentorSuggestions.length > 0 && (
                      <div className={styles.suggestionSection}>
                        <h4 className={styles.suggestionSectionHeader}>Mentors</h4>
                        <div className={styles.suggestionCardsGrid}>
                          {mentorSuggestions.map((item) => (
                            <MentorSuggestionRow
                              key={item.mentor_id}
                              mentor={item}
                              onClick={() => {
                                navigate(`/mentor/${item.mentor_id}`);
                                setIsMobileSearchActive(false);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className={styles.mobileSearchPlaceholder}>
                <div className={styles.searchPromptIcon}>
                  <Search size={40} />
                </div>
                <p className={styles.searchPromptText}>Search for questions or mentors</p>
                <div className={styles.popularTags}>
                  <span className={styles.popularTag} onClick={() => setSearchContent("Math")}>Math</span>
                  <span className={styles.popularTag} onClick={() => setSearchContent("Physics")}>Physics</span>
                  <span className={styles.popularTag} onClick={() => setSearchContent("Programming")}>Programming</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPageOne;
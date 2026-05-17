import React, {
  useState,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";

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

const StudentPageOne = () => {
  const navigate = useNavigate();
  const projectName = "MentroLink";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchContent, setSearchContent] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  const signedProfileUrl = useSignedImage(profile?.profile_picture ?? "");

  // ================= FETCH PROFILE =================
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) return;

      const { data, error: profileError } = await supabase
        .from("profile")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        console.log("Profile Error:", profileError.message);
        return;
      }

      setProfile(data);
    };

    fetchProfile();
  }, []);

  // ================= FETCH MENTOR STATUS =================
  useEffect(() => {
    const fetchMentorStatus = async () => {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) return;

      const { data, error: mentorError } = await supabase
        .from("mentor")
        .select("mentor_id")
        .eq("mentor_id", authData.user.id)
        .single();

      if (data) {
        setIsMentor(true);
      }
    };
    fetchMentorStatus();
  }, []);

  // ================= FETCH QUESTIONS =================
  useEffect(() => {
    const fetchQuestions = async () => {
      setQuestionsLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setQuestionsLoading(false);
        return;
      }

      // Fetch student subjects
      const { data: subjectData, error: subjectError } = await supabase
        .from("student_subjects")
        .select("course_name")
        .eq("student_id", authData.user.id);

      const subjectNames = subjectData ? subjectData.map((s) => s.course_name) : [];
      const studentSubjectsSet = new Set(subjectNames);

      // Fetch ALL questions
      const { data: questionData, error: questionError } = await supabase
        .from("question")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (questionError) {
        console.log("Question fetch error:", questionError.message);
        setQuestionsLoading(false);
        return;
      }

      const allFetchedQuestions = questionData || [];

      const matched: Question[] = [];
      const unmatched: Question[] = [];

      allFetchedQuestions.forEach(q => {
        if (studentSubjectsSet.has(q.subject)) {
          matched.push(q);
        } else {
          unmatched.push(q);
        }
      });

      matched.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
      unmatched.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

      setAllMatchedQuestions(matched);
      setMatchedQuestions(matched);

      setAllUnmatchedQuestions(unmatched);
      setUnmatchedQuestions(unmatched);

      setQuestionsLoading(false);
    };

    fetchQuestions();
  }, []);

  // ================= FETCH NOTIFICATIONS =================
  useEffect(() => {
    const fetchNotifications = async () => {
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
        const questionIds = notifData.map(n => n.question_id).filter(Boolean);
        let questionsMap: Record<string, string> = {};

        if (questionIds.length > 0) {
          const { data: qData } = await supabase
            .from("question")
            .select("question_id, topic")
            .in("question_id", questionIds);

          if (qData) {
            qData.forEach(q => {
              questionsMap[q.question_id] = q.topic;
            });
          }
        }

        const formatted = notifData.map((n: any) => ({
          ...n,
          topic: questionsMap[n.question_id] || "Your Question"
        }));

        setNotifications(formatted);
      }
    };
    fetchNotifications();
  }, []);

  // ================= SEARCH =================
  useEffect(() => {
    if (!searchContent.trim()) {
      setMatchedQuestions(allMatchedQuestions);
      setUnmatchedQuestions(allUnmatchedQuestions);
      return;
    }

    const lower = searchContent.toLowerCase();

    const filteredMatched = allMatchedQuestions.filter(
      (q) =>
        q.subject.toLowerCase().includes(lower) ||
        q.topic.toLowerCase().includes(lower) ||
        q.teacher_name.toLowerCase().includes(lower) ||
        q.description.toLowerCase().includes(lower),
    );

    const filteredUnmatched = allUnmatchedQuestions.filter(
      (q) =>
        q.subject.toLowerCase().includes(lower) ||
        q.topic.toLowerCase().includes(lower) ||
        q.teacher_name.toLowerCase().includes(lower) ||
        q.description.toLowerCase().includes(lower),
    );

    setMatchedQuestions(filteredMatched);
    setMatchedVisibleCount(4);

    setUnmatchedQuestions(filteredUnmatched);
    setUnmatchedVisibleCount(4);
  }, [searchContent, allMatchedQuestions, allUnmatchedQuestions]);

  const performSearch = () => setSearchOpen(false);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") performSearch();
  };

  const handleIconClick = () => {
    if (!searchOpen) setSearchOpen(true);
    else performSearch();
  };

  const handleSearchContent = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchContent(e.target.value);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase
        .from("notification")
        .update({ is_read: true })
        .eq("notification_id", notif.notification_id);

      setNotifications(prev => {
        const updated = prev.map(n => n.notification_id === notif.notification_id ? { ...n, is_read: true } : n);
        // Sort again: unread first
        return updated.sort((a, b) => {
          if (a.is_read === b.is_read) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return a.is_read ? 1 : -1;
        });
      });
    }
    navigate(`/question/${notif.question_id}`);
    setShowNotifications(false);
  };

  const lorem = "Lorem ipsum dolor sit amet ";

  return (
    <div className={styles.TopContainer}>
      <QuestionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* ================= NAVBAR ================= */}
      <nav className={styles.LandingNavbar}>
        <div className={styles.leftSide}>
          <div className={styles.logo}>
            <span className={styles.dot}></span>
            <span className={styles.logoName}>
              {projectName[0]}
              <span className={styles["logo-text-rest"]}>
                {projectName.slice(1)}
              </span>
            </span>
          </div>

          <button
            className={styles.askQuestionButton}
            onClick={() => setIsFormOpen(true)}
          >
            Ask Question
          </button>
        </div>

        <div className={styles.navActions}>
          <div className={styles.searchBarContainer}>
            <input
              type="text"
              placeholder="Search by subject, topic, teacher..."
              value={searchContent}
              onChange={handleSearchContent}
              onKeyDown={handleKey}
              className={
                searchOpen
                  ? styles.searchBar
                  : styles.searchBar + " " + styles.searchBarClosed
              }
            />
            <img
              src={searchIcon}
              alt="Search"
              className={styles.searchIcon}
              onClick={handleIconClick}
            />
          </div>

          <div className={styles.notificationWrapper}>
            <div
              className={styles.bellIconContainer}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className={styles.bellIcon} />
              {notifications.some(n => !n.is_read) && (
                <span className={styles.notificationBadge}></span>
              )}
            </div>

            {showNotifications && (
              <div className={styles.notificationDropdown}>
                <h4 className={styles.notificationHeader}>Notifications</h4>
                {notifications.length === 0 ? (
                  <p className={styles.noNotifications}>No new notifications.</p>
                ) : (
                  <>
                    <div className={styles.notificationList}>
                      {(showAllNotifications ? notifications : notifications.slice(0, 5)).map(notif => (
                        <div
                          key={notif.notification_id}
                          className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className={styles.notifDot}></div>
                          <div className={styles.notifContent}>
                            <p>New reply on: <strong>{notif.topic}</strong></p>
                            <span>{new Date(notif.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {notifications.length > 5 && !showAllNotifications && (
                      <button
                        className={styles.viewMoreBtn}
                        onClick={() => setShowAllNotifications(true)}
                      >
                        <ChevronDown size={16} /> View More
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className={styles.modeButton}>
            <ModeButton />
          </div>

          <button
            className={styles.mentorOptionButton}
            onClick={() => isMentor ? navigate("/mentor-dashboard", { replace: false }) : navigate("/mentor-profile")}
          >
            {isMentor ? "Switch to Mentor" : "Continue as Mentor"}
          </button>

          <div className={styles.profileSideBar}>
            {!open && (
              <img
                src={signedProfileUrl || userIcon}
                alt="Profile"
                className={styles.profilePic}
                onClick={() => setOpen(true)}
              />
            )}
          </div>

          {open && (
            <div
              className={styles.overlay}
              onClick={() => {
                setOpen(false);
                setPreviewImage(false);
              }}
            >
              <div
                className={styles.sideBar}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.sideBarContent}>
                  <div className={styles.sideBarHeader}>
                    <img
                      src={signedProfileUrl || userIcon}
                      alt="Profile"
                      className={styles.profilePicInSidebar}
                      onClick={() => setPreviewImage(true)}
                    />
                    <p className={styles.userName}>
                      {profile?.user_name || "User"}
                    </p>
                  </div>

                  <button
                    className={
                      styles.mentorOptionButton +
                      " " +
                      styles.mentorOptionButtonSide
                    }
                    onClick={() => {
                      setOpen(false);
                      isMentor ? navigate("/mentor-dashboard") : navigate("/mentor-profile");
                    }}
                  >
                    {isMentor ? "Switch to Mentor" : "Continue as Mentor"}
                  </button>

                  <div className={styles.modeButtonSide}>
                    <span>Change Mode</span>
                    <ModeButton />
                  </div>

                  <div className={styles.menuItems}>
                    <p>Dashboard</p>
                    <button
                      onClick={() => navigate("/profile")}
                      className={styles.profileEditButton}
                    >
                      My Profile
                    </button>
                    <p>Settings</p>
                    <p
                      className={styles.logout}
                      onClick={handleLogout}
                      style={{ cursor: 'pointer' }}
                    >
                      Logout
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {open && previewImage && (
            <div
              className={styles.imageOverlay}
              onClick={() => setPreviewImage(false)}
            >
              <img
                src={signedProfileUrl || userIcon}
                alt="Preview"
                className={styles.previewImage}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </nav>

      {/* ================= BODY ================= */}
      <div className={styles.body}>

        {/* MATCHED QUESTIONS SECTION */}
        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}>
            <h3 className={styles.sectionTitle}>Questions for Your Subjects</h3>
          </div>
          {questionsLoading ? (
            <p className={styles.loadingText}>Loading questions...</p>
          ) : matchedQuestions.length === 0 ? (
            <p className={styles.emptyText}>
              {searchContent
                ? "No questions match your search in your subjects."
                : "No questions found for your subjects yet."}
            </p>
          ) : (
            <>
              <div className={styles.questionsList}>
                {matchedQuestions.slice(0, matchedVisibleCount).map((q) => (
                  <QuestionCard
                    key={q.question_id}
                    id={q.question_id}
                    subject={q.subject}
                    topic={q.topic}
                    description={q.description}
                    teacherName={q.teacher_name}
                    uploadedAt={q.uploaded_at}
                    fileUpload={q.file_upload}
                  />
                ))}
              </div>
              {matchedVisibleCount < matchedQuestions.length && (
                <div className={styles.loadMoreContainer}>
                  <button
                    className={styles.loadMoreBtn}
                    onClick={() => setMatchedVisibleCount(prev => prev + 4)}
                  >
                    See More Questions
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* UNMATCHED QUESTIONS SECTION */}
        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}>
            <h3 className={styles.sectionTitle}>Other Questions</h3>
          </div>
          {questionsLoading ? (
            <p className={styles.loadingText}>Loading questions...</p>
          ) : unmatchedQuestions.length === 0 ? (
            <p className={styles.emptyText}>
              {searchContent
                ? "No other questions match your search."
                : "No other questions found."}
            </p>
          ) : (
            <>
              <div className={styles.questionsList}>
                {unmatchedQuestions.slice(0, unmatchedVisibleCount).map((q) => (
                  <QuestionCard
                    key={q.question_id}
                    id={q.question_id}
                    subject={q.subject}
                    topic={q.topic}
                    description={q.description}
                    teacherName={q.teacher_name}
                    uploadedAt={q.uploaded_at}
                    fileUpload={q.file_upload}
                  />
                ))}
              </div>
              {unmatchedVisibleCount < unmatchedQuestions.length && (
                <div className={styles.loadMoreContainer}>
                  <button
                    className={styles.loadMoreBtn}
                    onClick={() => setUnmatchedVisibleCount(prev => prev + 4)}
                  >
                    See More Questions
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.questionsSection}>
          <div className={styles.questionBlockTitle}>
            <h3 className={styles.sectionTitle}>Top Mentors</h3>
          </div>
          <div className={styles.mentorCard}>
            <MentorCard
              image="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9SRRmhH4X5N2e4QalcoxVbzYsD44C-sQv-w&s"
              userName="Ali"
              Description={lorem.repeat(30)}
            />
            <MentorCard
              image="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9SRRmhH4X5N2e4QalcoxVbzYsD44C-sQv-w&s"
              userName="Ayesha"
              Description={lorem.repeat(10)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPageOne;

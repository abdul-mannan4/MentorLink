import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Groq } from "groq-sdk";
import { supabase } from "../../supabase-client";
import style from './MentorDashboard.module.css';
import ModeButton from "../ModeButton/ModeButton";

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
    try {
      // Step 0: Auto-backfill missing notifications for existing questions
      const { data: mentorSubjects } = await supabase
        .from("mentor_subjects")
        .select("course_name")
        .eq("mentor_id", currentUserId);

      if (mentorSubjects && mentorSubjects.length > 0) {
        const subjectNames = mentorSubjects.map(s => s.course_name).filter(Boolean);

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

          const existingQids = new Set(existingNotifs?.map(n => n.question_id) || []);

          // Find questions without notifications
          const missingNotifs = questionsData
            .filter(q => !existingQids.has(q.question_id))
            .map(q => ({
              recipient_id: currentUserId,
              sender_id: q.student_id,
              question_id: q.question_id,
              type: "new_question"
            }));

          // Insert them if any are missing
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
        console.error(`Error fetching notifications: ${notifError.message}`);
        return;
      }

      console.log("Fetched notifications raw data:", notifData);

      if (!notifData || notifData.length === 0) {
        console.log(`No notifications found for recipient_id: ${currentUserId}`);
        setNotifications([]);
        return;
      }

      // Step 2: Fetch the corresponding questions manually
      const questionIds = notifData.map(n => n.question_id).filter(id => id != null);

      let questionsMap: Record<string, any> = {};

      if (questionIds.length > 0) {
        const { data: qData, error: qError } = await supabase
          .from("question")
          .select("question_id, topic, subject")
          .in("question_id", questionIds);

        if (!qError && qData) {
          questionsMap = qData.reduce((acc: Record<string, any>, q: any) => {
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

      const repliedSet = new Set(replyData?.map(r => r.question_id) || []);

      const formatted = notifData.map((n: any) => ({
        ...n,
        topic: questionsMap[n.question_id as string]?.topic || "New Question",
        subject: questionsMap[n.question_id as string]?.subject || "Student Query",
        has_replied: repliedSet.has(n.question_id)
      }));

      // Sort: unreplied first, then replied.
      formatted.sort((a, b) => {
        if (a.has_replied === b.has_replied) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.has_replied ? 1 : -1;
      });

      setNotifications(formatted);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchSubjects(user.id);
        fetchNotifications(user.id);
      }
    };
    init();
  }, []);

  const pendingSubjects = subjects.filter((s) => s.marks === -1);
  const completedSubjects = subjects.filter((s) => s.marks >= 0 && s.marks <= 15);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (testActive && !scoreSummary && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (testActive && !scoreSummary && timeLeft === 0) {
      submitTest();
    }
    return () => clearInterval(timer);
  }, [testActive, timeLeft, scoreSummary]);

  const submitTest = async (): Promise<void> => {
    if (!testData || !userId) return;
    let marks = 0;
    testData.questions.forEach((q, index) => {
      if (userAnswers[index] === q.correctAnswer) marks++;
    });
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("mentor_subjects")
        .update({ marks, test_taken_at: now })
        .eq("mentor_id", userId)
        .eq("course_name", activeTask);
      if (error) throw error;
      setScoreSummary({ score: marks, total: testData.questions.length });
    } catch (err) {
      console.error("Error updating marks:", err);
      console.error("Failed to submit test. Please try again.");
    }
  };

  const closeTest = (): void => {
    setTestActive(false);
    setActiveTask(null);
    setTestData(null);
    setScoreSummary(null);
    if (userId) {
      fetchSubjects(userId);
      fetchNotifications(userId);
    }
  };

  const navigate = useNavigate();

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await supabase
          .from("notification")
          .update({ is_read: true })
          .eq("notification_id", notif.notification_id);
      }
      navigate(`/question/${notif.question_id}`);
    } catch (err) {
      console.error("Error marking notification as read:", err);
      navigate(`/question/${notif.question_id}`);
    }
  };

  const handleRetakeTest = (subjectObj: Subject): void => {
    const subjectName = subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
    if (subjectObj.test_taken_at) {
      const takenAt = new Date(subjectObj.test_taken_at).getTime();
      const diffMs = Date.now() - takenAt;
      const cooldownMs = 5 * 60 * 1000;
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
      setGeneratedText("Error: GROQ_API_KEY is missing. Please add it to your .env file and restart the server.");
      setIsGenerating(false);
      return;
    }

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: 'You are an expert university-level exam question generator. Your task is to create exactly 15 multiple-choice questions (MCQs), no more no less, exactly 15, in json format based on the subject provided by the user. Each question should have normal difficulty, suitable for university students. You MUST output ONLY valid JSON using this exact schema, with no additional text or formatting: { "questions": [ { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0 } ] } where correctAnswer is the integer index (0-3) of the correct option. Ensure options are distinct. and make sure there are 15 questions, no more no less',
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
            <Link to="/student" className={style['mentor-switch-btn']}>Switch to Student</Link>
            <span className={style['mentor-mode-badge']}>Mentor Mode</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className={style['mentor-main']}>

        {/* Notifications Section */}
        <div className={style['mentor-section-container']}>
          <div className={style['mentor-section-header']}>
            <h2 className={style['mentor-section-title']}>Recent Notifications</h2>
          </div>
          <div className={style['mentor-notifications-list']}>
            {notifications.length === 0 ? (
              <p className={style['mentor-no-notif-text']}>No new notifications yet.</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`${style['mentor-notification-item']} ${!notif.is_read && !notif.has_replied ? style['mentor-notification-unread'] : ''
                    } ${notif.has_replied ? style['mentor-notification-replied'] : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  {!notif.has_replied && <div className={style['mentor-notif-dot']}></div>}
                  <div className={style['mentor-notif-content']}>
                    <p className={style['mentor-notif-text']}>
                      {notif.has_replied && <span style={{ color: '#888', fontStyle: 'italic', marginRight: '6px' }}>[Replied]</span>}
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
        </div>

        <div className={style['mentor-section-header']}>
          <h1 className={style['mentor-section-title']}>Pending Tasks</h1>
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
              const subjectName =
                subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
              return (
                <motion.div
                  key={`pending-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => runGroqGeneration(subjectName)}
                  // ✅ FIX: each class accessed separately
                  className={`${style['mentor-card']} ${style['mentor-card--pending']}`}
                >
                  <div>
                    {/* ✅ FIX: separate classes joined with template literal */}
                    <div className={`${style['mentor-card-icon']} ${style['mentor-card-icon--primary']}`}>
                      <svg
                        className={`${style['mentor-icon']} ${style['mentor-icon--primary']}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <h3 className={style['mentor-card-title']}>Take Test</h3>
                    <p className={style['mentor-card-subject']}>{subjectName}</p>
                  </div>
                  <div className={style['mentor-card-action']}>
                    Start Task
                    <svg
                      className={style['mentor-card-arrow']}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Completed Tests Section */}
        {completedSubjects.length > 0 && (
          <div className={style['mentor-completed-section']}>
            <div className={style['mentor-section-header']}>
              <h2 className={style['mentor-section-title']}>Completed Tests</h2>
              <p className={style['mentor-section-subtitle']}>
                Subjects you have successfully verified.
              </p>
            </div>
            <div className={style['mentor-card-grid']}>
              {completedSubjects.map((subjectObj, index) => {
                const subjectName =
                  subjectObj["Course Name"] || subjectObj.course_name || "Unknown Subject";
                return (
                  <motion.div
                    key={`comp-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    // ✅ FIX
                    className={`${style['mentor-card']} ${style['mentor-card--completed']}`}
                  >
                    <div>
                      {/* ✅ FIX */}
                      <div className={`${style['mentor-card-icon']} ${style['mentor-card-icon--emerald']}`}>
                        <svg
                          className={`${style['mentor-icon']} ${style['mentor-icon--emerald']}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className={style['mentor-card-title']}>{subjectName}</h3>
                      <p className={style['mentor-card-score']}>
                        Score: {subjectObj.marks} / 15
                      </p>
                    </div>
                    <div className={style['mentor-card-retake']}>
                      <button
                        onClick={() => handleRetakeTest(subjectObj)}
                        className={style['mentor-retake-btn']}
                      >
                        Retake Test
                        <svg
                          className={style['mentor-icon--sm']}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loader */}
        <AnimatePresence>
          {isGenerating && !testActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={style['mentor-loader-overlay']}
            >
              <div className={style['mentor-loader-box']}>
                <svg
                  className={style['mentor-spinner']}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className={style['mentor-spinner-track']}
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className={style['mentor-spinner-fill']}
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
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

      {/* Test Modal */}
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
                    <svg
                      className={style['mentor-score-check']}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className={style['mentor-score-heading']}>Test Completed!</h2>
                  <p className={style['mentor-score-text']}>
                    You scored{" "}
                    <span className={style['mentor-score-value']}>{scoreSummary.score}</span>
                    {" "}out of {scoreSummary.total}
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
                      <svg
                        className={style['mentor-timer-icon']}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                              // ✅ FIX: conditional second class accessed separately
                              className={`${style['mentor-option']} ${userAnswers[qIndex] === oIndex ? style['mentor-option--selected'] : ""
                                }`}
                            >
                              <div className={style['mentor-option-radio-wrap']}>
                                <input
                                  type="radio"
                                  name={`q-${qIndex}`}
                                  value={oIndex}
                                  checked={userAnswers[qIndex] === oIndex}
                                  onChange={() =>
                                    setUserAnswers({ ...userAnswers, [qIndex]: oIndex })
                                  }
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

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className={style['mentor-toast']}
          >
            <svg
              className={style['mentor-toast-icon']}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={style['mentor-toast-text']}>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import { getCache, setCache } from "../../utils/cache";
import QuestionCard from "../../components/QuestionCard/QuestionCard";
import styles from "./StudentDashboard.module.css";

type Question = {
  question_id: string;
  subject: string;
  topic: string;
  description: string;
  teacher_name: string;
  uploaded_at: string;
  file_upload: string | null;
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const switchingRef = useRef(false);
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    // Push dummy state to capture back button/swipes if not already present
    if (!window.history.state || !window.history.state.isDummyDashboard) {
      window.history.pushState({ isDummyDashboard: true }, "", window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (switchingRef.current) {
        navigate("/student", { replace: true });
        return;
      }
      // Re-push dummy state to block going back
      window.history.pushState({ isDummyDashboard: true }, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  const handleReturnHome = () => {
    switchingRef.current = true;
    window.history.go(-1);
  };

  useEffect(() => {
    const loadQuestions = async () => {
      const cached = getCache("studentDashboardQuestions");
      if (cached) {
        setQuestions(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          setError("User not authenticated.");
          return;
        }

        const { data, error } = await supabase
          .from("question")
          .select("question_id, subject, topic, description, teacher_name, uploaded_at, file_upload")
          .eq("student_id", authData.user.id)
          .order("uploaded_at", { ascending: false });

        if (error) {
          setError("Unable to load questions. Please refresh.");
        } else if (data) {
          setQuestions(data as Question[]);
          setCache("studentDashboardQuestions", data);
        }
      } catch (err) {
        console.error("Error loading dashboard questions:", err);
        setError("Unable to load questions. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const filtered = questions.filter((item) => {
    const query = search.toLowerCase();
    return (
      item.subject.toLowerCase().includes(query) ||
      item.topic.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.teacher_name.toLowerCase().includes(query)
    );
  });

  if (activeMode !== "student") {
    return null;
  }

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.dashboardHeader}>
        <div>
          <p className={styles.breadcrumb} onClick={handleReturnHome}>Home</p>
          <h1 className={styles.heading}>Student Dashboard</h1>
          <p className={styles.subheading}>Browse your posted questions and track replies.</p>
        </div>
        <button className={styles.backButton} onClick={handleReturnHome}>Return to Student Home</button>
      </header>

      <section className={styles.questionsSection}>
        <div className={styles.questionsToolbar}>
          <h2>My Questions</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, topic, or teacher"
            className={styles.searchInput}
          />
        </div>

        {loading ? (
          <p className={styles.statusText}>Loading questions...</p>
        ) : error ? (
          <p className={styles.statusText}>{error}</p>
        ) : filtered.length === 0 ? (
          <p className={styles.statusText}>No questions found.</p>
        ) : (
          <div className={styles.questionList}>
            {filtered.map((question) => (
              <QuestionCard
                key={question.question_id}
                id={question.question_id}
                subject={question.subject}
                topic={question.topic}
                description={question.description}
                teacherName={question.teacher_name}
                uploadedAt={question.uploaded_at}
                fileUpload={question.file_upload}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentDashboard;

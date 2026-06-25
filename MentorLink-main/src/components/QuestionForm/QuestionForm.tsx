import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import styles from "./QuestionForm.module.css";
import { supabase } from "../../supabase-client";
import Select from "react-select";

const subjects = [
  "Fundamentals of Accounting",
  "Programming for Artificial Intelligence",
  "Knowledge Representation and Reasoning",
  "Machine Learning",
  "Artificial Neural Networks and Deep Learning",
  "Natural Language Processing",
  "Computer Vision",
  "Discrete Structures",
  "Programming Fundamentals",
  "Digital Logic Design (DLD)",
  "Programming Fundamentals (PF)",
  "Database Systems",
  "Object Oriented Programming (OOP)",
  "Software Engineering Fundamentals",
  "Data Structures (DS)",
  "Data Communication and Networks",
  "Information Security",
  "Introduction to Artificial Intelligence",
  "Computer Organization & Assembly Language (COAL)",
  "Operating Systems (OS)",
  "Introduction to ICT",
  "Digital Logic Design",
  "Computer Organization & Assembly Language",
  "Theory of Automata and Formal Languages (TA)",
  "HCI & Computer Graphics",
  "Design And Analysis of Algorithms",
  "Compiler Construction",
  "Parallel and Distributed Computing",
  "Computer Architecture",
  "Advanced Database Systems",
  "Theory of Programming Languages",
  "Graph Theory",
  "Numerical Computing",
  "Functional English (FE)",
  "Expository Writing (EW)",
  "Technical and Business Writing",
  "Math Foundation-1",
  "Math Foundation-2",
  "Calculus and Analytic Geometry",
  "Linear Algebra",
  "Multivariable Calculus",
  "Differential Equations",
  "Financial Accounting",
  "Entrepreneurship",
  "Physics for Computing",
  "Software Design & Architecture",
  "Software Construction and Development",
  "Software Quality Engineering",
  "Web Engineering",
  "Software Project Management",
  "Human Computer Interaction",
  "Software Requirement Engineering",
  "Operations Research",
  "Formal Methods in Software Engineering",
  "Simulation and Modeling",
  "Introduction to Psychology",
  "Professional Practices",
  "Probability and Statistics",
  "Introduction to Textiles",

  "Applied Physics",
  "Islamic Studies",
  "Electric Circuits",
  "Computer Programming",
  "Electronic Devices and Circuits",
  "Technical Drawing",
  "Communication Skills",
  "Signals and Systems",
  "Computer Hardware Systems",
  "Instrumentation and Data Acquisition",
  "Web Technologies",
  "Mobile Application Development",
  "Embedded IoT Systems",
  "Systems and Network Administration",
  "Network Technologies",
  "Organizational Behavior",
  "Network Switching and Routing",
  "Blockchain Technology",
  "Machine Learning and Data Analytics",
  "HCI Technologies",
  "Technopreneurship",
  "Supervised Industrial Training"
].sort();

const subjectOptions = subjects.map((subject) => ({
  value: subject,
  label: subject,
}));


type Props = {
  isOpen: boolean;
  onClose: () => void;
  onQuestionPosted?: () => void;
};

const AskQuestionForm = ({ isOpen, onClose, onQuestionPosted }: Props) => {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentorCheckLoading, setMentorCheckLoading] = useState(false);
  const [noMentorRegistered, setNoMentorRegistered] = useState(false);

  useEffect(() => {
    if (!subject) {
      setNoMentorRegistered(false);
      return;
    }

    const checkMentor = async () => {
      if (subjects.includes(subject)) {
        setMentorCheckLoading(true);
        try {
          const { data, error } = await supabase
            .from("mentor_subjects")
            .select("mentor_id")
            .eq("course_name", subject)
            .limit(1);
          if (!error) {
            setNoMentorRegistered(!data || data.length === 0);
          } else {
            setNoMentorRegistered(false);
          }
        } catch (err) {
          console.error(err);
          setNoMentorRegistered(false);
        } finally {
          setMentorCheckLoading(false);
        }
      } else {
        setNoMentorRegistered(false);
      }
    };

    const handler = setTimeout(() => {
      checkMentor();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [subject]);

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError(null);
    const trimmedDescription = description.trim();
    if (!subject || !topic || !teacherName || !trimmedDescription) {
      setError("Please fill all required fields.");
      return;
    }

    if (trimmedDescription.length < 20) {
      setError("Please provide a more detailed description (at least 20 characters).");
      return;
    }

    if (trimmedDescription.length > 2000) {
      setError("Description is too long. Please shorten to under 2000 characters.");
      return;
    }

    if (!subjects.includes(subject)) {
      setError("Please select a valid subject from the list.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("User not found. Please log in again.");
      setLoading(false);
      return;
    }

    let fileUrl: string | null = null;

    // ================= UPLOAD FILE =================
    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `${authData.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("question-files")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload Error:", uploadError.message);
        console.error(`File upload failed: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("question-files")
        .getPublicUrl(filePath);
      fileUrl = data.publicUrl;
    }

    // ================= INSERT QUESTION =================
    const { data: questionData, error } = await supabase.from("question").insert([
      {
        student_id: authData.user.id,
        subject,
        topic,
        teacher_name: teacherName,
        description: trimmedDescription,
        file_upload: fileUrl,
      },
    ]).select().single();

    if (error) {
      console.error("Insert Error:", error.message);
      console.error(`Failed to post question: ${error.message}`);
      setLoading(false);
      return;
    }

    if (questionData) {
      // Find mentors who teach this subject and notify them
      const { data: mentorsData, error: mentorsError } = await supabase
        .from("mentor_subjects")
        .select("mentor_id")
        .eq("course_name", subject);

      if (!mentorsError && mentorsData && mentorsData.length > 0) {
        const notifications = mentorsData.map(m => ({
          recipient_id: m.mentor_id,
          sender_id: authData.user.id,
          question_id: questionData.question_id,
          type: "new_question"
        }));

        await supabase.from("notification").insert(notifications);
      }
    }

    console.log("Question posted successfully");
    setSubject("");
    setTopic("");
    setTeacherName("");
    setDescription("");
    setFile(null);
    setLoading(false);
    onClose();
    if (onQuestionPosted) {
      onQuestionPosted();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Ask a Question</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label>Subject</label>

            <Select
              options={subjectOptions}
              placeholder="Search subject..."
              value={
                subject
                  ? { value: subject, label: subject }
                  : null
              }
              onChange={(selectedOption) =>
                setSubject(selectedOption?.value || "")
              }
              isSearchable
              className={styles.selectWrapper}
              classNamePrefix="subjectSelect"
            />

            {mentorCheckLoading && (
              <small>Checking mentors...</small>
            )}

            {noMentorRegistered && (
              <div className={styles.mentorWarning}>
                ⚠️ Any mentor of this subject is not registered yet.
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label>Topic</label>
            <input
              type="text"
              placeholder="e.g. Binary Trees"
              className={styles.inputField}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Teacher Name</label>
            <input
              type="text"
              placeholder="e.g. Dr. Salman"
              className={styles.inputField}
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Description</label>
            <textarea
              placeholder="Provide details..."
              rows={4}
              className={styles.textField}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <small className={styles.charCount}>{description.length} / 2000</small>
              {error ? <small className={styles.errorText}>{error}</small> : null}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="fileUpload">Attachment (Optional)</label>
            <input
              id="fileUpload"
              type="file"
              className={styles.inputField}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? "Processing..." : "Post Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionForm;

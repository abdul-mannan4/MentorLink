import React, { useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./QuestionForm.module.css";
import { supabase } from "../../supabase-client";

const subjects = [
  "Advanced Database Systems",
  "Artificial Neural Networks and Deep Learning",
  "Calculus and Analytic Geometry",
  "Compiler Construction",
  "Computer Architecture",
  "Computer Organization & Assembly Language",
  "Computer Organization & Assembly Language (COAL)",
  "Computer Vision",
  "Data Communication and Networks",
  "Data Structures (DS)",
  "Database Systems",
  "Design And Analysis of Algorithms",
  "Differential Equations",
  "Digital Logic Design",
  "Digital Logic Design (DLD)",
  "Discrete Structures",
  "Entrepreneurship",
  "Expository Writing (EW)",
  "Financial Accounting",
  "Formal Methods in Software Engineering",
  "Functional English (FE)",
  "Fundamentals of Accounting",
  "Graph Theory",
  "HCI & Computer Graphics",
  "Human Computer Interaction",
  "Information Security",
  "Introduction to Artificial Intelligence",
  "Introduction to ICT",
  "Introduction to Psychology",
  "Introduction to Textiles",
  "Knowledge Representation and Reasoning",
  "Linear Algebra",
  "Machine Learning",
  "Math Foundation-1",
  "Math Foundation-2",
  "Multivariable Calculus",
  "Natural Language Processing",
  "Numerical Computing",
  "Object Oriented Programming (OOP)",
  "Operating Systems (OS)",
  "Operations Research",
  "Parallel and Distributed Computing",
  "Physics for Computing",
  "Probability and Statistics",
  "Professional Practices",
  "Programming Fundamentals",
  "Programming Fundamentals (PF)",
  "Programming for Artificial Intelligence",
  "Simulation and Modeling",
  "Software Construction and Development",
  "Software Design & Architecture",
  "Software Engineering Fundamentals",
  "Software Project Management",
  "Software Quality Engineering",
  "Software Requirement Engineering",
  "Technical and Business Writing",
  "Theory of Automata and Formal Languages (TA)",
  "Theory of Programming Languages",
  "Web Engineering",
].sort();

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const AskQuestionForm = ({ isOpen, onClose }: Props) => {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!subject || !topic || !teacherName || !description) {
      console.error("Please fill all fields");
      return;
    }

    if (!subjects.includes(subject)) {
      console.error("Please select a valid subject from the list.");
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error("User not found. Please log in again.");
      setLoading(false);
      return;
    }

    let fileUrl = null;

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
        description,
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
    window.location.reload();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Ask a Question</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="subjectInput">Subject</label>
            <input
              id="subjectInput"
              list="subjectOptions"
              type="text"
              placeholder="Search subject..."
              className={styles.inputField}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoComplete="off"
            />
            <datalist id="subjectOptions">
              {subjects.map((sub, i) => (
                <option key={i} value={sub} />
              ))}
            </datalist>
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

import { useState, useMemo, useRef } from "react";
import style from "./SubjectSearch.module.css";

type Props = {
  onChange: (subjects: string[]) => void;
};
function SubjectSearch({ onChange }: Props) {
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
  ];

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedSubject, setSelectedSubjects] = useState<string[]>([]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(
      (subject) =>
        !selectedSubject.includes(subject) &&
        subject.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  function handleSelect(subject: string) {
    const updated = selectedSubject.includes(subject)
      ? selectedSubject
      : [...selectedSubject, subject];
    setSelectedSubjects(updated);
    onChange(updated);
    setQuery("");
  }

  function handleRemove(subject: string) {
    const updated = selectedSubject.filter((sub) => sub !== subject);
    onChange(updated);
    setSelectedSubjects(updated);
  }

  return (
    <div
      className={style["input-wrapper"]}
      onClick={() => inputRef.current?.focus()}
    >
      {/* ✅ selected tags inside the input box */}
      {selectedSubject.map((sub) => (
        <span key={sub} className={style.tag}>
          {sub}
          <button
            type="button"
            className={style["tag-remove"]}
            onClick={(e) => {
              // ← stops click from bubbling to wrapper
              handleRemove(sub);
            }}
          >
            ×
          </button>
        </span>
      ))}

      {/* ✅ input sits next to tags */}
      <input
        ref={inputRef}
        placeholder={selectedSubject.length === 0 ? "e.g. Database" : ""}
        value={query}
        disabled={selectedSubject.length === 3}
        onChange={(e) => setQuery(e.target.value)}
        className={style["tag-input"]}
      />

      {/* dropdown */}
      {query && selectedSubject.length <3 && (
        <ul className={style.list}>
          {filteredSubjects.map((subject) => (
            <li key={subject} onClick={() => handleSelect(subject)}>
              {subject}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export default SubjectSearch;

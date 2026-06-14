import React, { useEffect, useState } from "react";
import style from "./Profile.module.css";
import type { ChangeEvent } from "react";
import { supabase } from "../../supabase-client";
import { useNavigate } from "react-router-dom";

import UploadImage from "./imageUpload";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import SubjectSearch from "./SubjectSearch";

function Profile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [university] = useState("National Textile University");

  const [username, setUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [technology, setTechnology] = useState("");

  const [difficultSubjects, setDifficultSubjects] = useState<string[]>([]);

  const [profileImage, setProfileImage] = useState("");

  const signedUrl = useSignedImage(profileImage);

  // ================= GET USER =================
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user.email);
      }
    };
    getUser();
  }, []);

  // ================= GET PROFILE + SUBJECTS =================
  useEffect(() => {
    const getProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Fetch profile
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (error) {
        console.log(error.message);
        return;
      }

      if (data) {
        setName(data.name || "");
        setUsername(data.user_name || "");
        setDepartment(data.department || "");
        setBatch(data.batch || "");
        setTechnology(data.technology || "");
        setProfileImage(data.profile_picture || "");
      }

      // Fetch difficult subjects
      const { data: subjectData, error: subjectError } = await supabase
        .from("student_subjects")
        .select("course_name")
        .eq("student_id", userData.user.id);

      if (subjectError) {
        console.log("Subject fetch error:", subjectError.message);
        return;
      }

      if (subjectData && subjectData.length > 0) {
        setDifficultSubjects(subjectData.map((s) => s.course_name));
      }
    };

    getProfile();
  }, []);

  // ================= SAVE PROFILE =================
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      console.log("No user found");
      setLoading(false);
      return;
    }

    // UPSERT PROFILE — save raw storage path, NOT signedUrl
    const { error } = await supabase.from("profile").upsert([
      {
        id: userData.user.id,
        name: name,
        user_name: username,
        profile_picture: profileImage, // ✅ raw path, not signedUrl
        university_email: userData.user.email,
        university_name: university,
        department: department,
        technology: technology,
        batch: batch,
      },
    ]);

    if (error) {
      console.log(error.message);
      setLoading(false);
      return;
    }

    // DELETE old subjects then INSERT updated ones
    const { error: deleteError } = await supabase
      .from("student_subjects")
      .delete()
      .eq("student_id", userData.user.id);

    if (deleteError) {
      console.log("Delete subjects error:", deleteError.message);
      setLoading(false);
      return;
    }

    if (difficultSubjects.length > 0) {
      const subjectToInsert = difficultSubjects.map((subject) => ({
        student_id: userData.user.id,
        course_name: subject,
      }));

      const { error: subjectError } = await supabase
        .from("student_subjects")
        .insert(subjectToInsert);

      if (subjectError) {
        console.log("Insert subjects error:", subjectError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate("/userDashboard");
  };

  return (
    <div className={style.profileContainer}>
      <div className={style.profileCard}>
        <h2>MentorLink</h2>
        <h1>Complete Your Profile</h1>

        <form className={style.form} onSubmit={handleSubmit}>
          {/* IMAGE */}
          <UploadImage
            onUpload={(path) => setProfileImage(path)}
            currentImage={profileImage}
            previewUrl={signedUrl} // signedUrl used for display only
          />

          {/* NAME */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
            />
          </div>

          {/* EMAIL */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Email</label>
            <input type="email" value={email} disabled />
          </div>

          {/* USERNAME */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Username</label>
            <input
              type="text"
              placeholder="Username"
              value={username}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setUsername(e.target.value)
              }
            />
          </div>

          {/* UNIVERSITY */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>University</label>
            <input type="text" value={university} disabled />
          </div>

          {/* DEPARTMENT */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Department</label>
            <select
              required
              value={department}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setDepartment(e.target.value)
              }
            >
              <option value="" hidden>
                Select Department
              </option>
              <option value="DCS">Computer Science</option>
              <option value="FD" disabled>
                Fashion Design
              </option>
              <option value="Textile" disabled>
                Textile Engineering
              </option>
              <option value="DAS" disabled>
                Applied Sciences
              </option>
            </select>
          </div>

          {/* BATCH */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Batch</label>
            <input
              type="text"
              placeholder="e.g 2023"
              value={batch}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setBatch(e.target.value)
              }
            />
          </div>

          {/* TECHNOLOGY */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Technology</label>
            <select
              required
              value={technology}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setTechnology(e.target.value)
              }
            >
              <option value="" hidden>
                Select Technology
              </option>
              <option value="CS">CS</option>
              <option value="SE">SE</option>
              <option value="AI">AI</option>
              <option value="CET">CET</option>
            </select>
          </div>

          {/* SUBJECTS */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Difficult Subjects</label>
            <div className={style.wrapper}>
              <SubjectSearch
                onChange={setDifficultSubjects}
                initialSubjects={difficultSubjects}
              />
            </div>
          </div>

          {/* BUTTON */}
          <button type="submit" className={style.submitBtn}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;

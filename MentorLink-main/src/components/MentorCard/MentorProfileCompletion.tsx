import React, { useEffect, useState } from "react";
import style from "../../Screens/Authentication/Profile.module.css";
import type { ChangeEvent } from "react";
import { supabase } from "../../supabase-client";
import { useNavigate } from "react-router-dom";
import { setCache } from "../../utils/cache";

import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";
import SubjectSearch from "../../Screens/Authentication/SubjectSearch";
import UploadImage from "../../Screens/Authentication/imageUpload";

function MentorProfileCompletion() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [description, setDescription] = useState("");
  const [expertSubjects, setExpertSubjects] = useState<string[]>([]);
  const [existingSubjects, setExistingSubjects] = useState<{ course_name: string; marks: number }[]>([]);
  const [difficultSubjects, setDifficultSubjects] = useState<string[]>([]);
  const [mentorExists, setMentorExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const signedUrl = useSignedImage(profileImage);

  useEffect(() => {
    const getProfileData = async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) {
        navigate("/", { replace: true });
        return;
      }

      setEmail(userData.user.email || "");

      // Fetch profile and existing mentor details
      const [
        { data: profileData, error: profileError },
        { data: mentorData },
        { data: subjectData },
        { data: difficultSubjectData }
      ] = await Promise.all([
        supabase.from("profile").select("*").eq("id", userData.user.id).single(),
        supabase.from("mentor").select("Description").eq("mentor_id", userData.user.id).single(),
        supabase.from("mentor_subjects").select("course_name").eq("mentor_id", userData.user.id),
        supabase.from("student_subjects").select("course_name").eq("student_id", userData.user.id),
      ]);

      if (profileError) {
        console.log("Profile error:", profileError.message);
      }

      if (profileData) {
        setName(profileData.name || "");
        setProfileImage(profileData.profile_picture || "");
      }

      if (mentorData) {
        setDescription(mentorData.Description || "");
        setMentorExists(true);
      }

      if (subjectData) {
        setExistingSubjects(subjectData as { course_name: string; marks: number }[]);
        setExpertSubjects(
          subjectData
            .map((item: { course_name: string }) => item.course_name)
            .filter(Boolean)
        );
      }

      if (difficultSubjectData) {
        setDifficultSubjects(
          difficultSubjectData
            .map((item: { course_name: string }) => item.course_name)
            .filter(Boolean)
        );
      }
    };

    getProfileData();
  }, [navigate]);

  // ================= SAVE MENTOR PROFILE =================
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    
    if (expertSubjects.length !== 3) {
      setErrorMessage("Please select exactly 3 subjects.");
      return;
    }

    const overlapping = expertSubjects.filter((subject) =>
      difficultSubjects.includes(subject)
    );

    if (overlapping.length > 0) {
      setErrorMessage(
        `You cannot select "${overlapping.join(", ")}" as an expert subject because you marked it as a difficult subject during signup.`
      );
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Please provide a description (bio).");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setErrorMessage("No user session found. Please log in.");
      setLoading(false);
      return;
    }

    // CREATE OR UPDATE MENTOR RECORD (also store name and profile_picture for public browsing)
    const { error: mentorError } = await supabase.from("mentor").upsert([
      {
        mentor_id: userData.user.id,
        Description: description,
        no_of_replies: 0,
        progress: "0",
        rating: 0,
        name: name,
        profile_picture: profileImage || null,
      },
    ]);

    if (mentorError) {
      console.log("Error inserting mentor:", mentorError.message);
      setErrorMessage("Error saving mentor profile: " + mentorError.message);
      setLoading(false);
      return;
    }

    // Sync subjects: only delete removed ones, and only insert new ones
    const subjectsToDelete = existingSubjects
      .filter((s) => !expertSubjects.includes(s.course_name))
      .map((s) => s.course_name);

    const subjectsToInsert = expertSubjects
      .filter((subject) => !existingSubjects.some((s) => s.course_name === subject))
      .map((subject) => ({
        mentor_id: userData.user.id,
        course_name: subject,
        marks: -1,
      }));

    if (subjectsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("mentor_subjects")
        .delete()
        .eq("mentor_id", userData.user.id)
        .in("course_name", subjectsToDelete);

      if (deleteError) {
        console.log("Delete subjects error:", deleteError.message);
        setErrorMessage("Error preparing subjects: " + deleteError.message);
        setLoading(false);
        return;
      }
    }

    if (subjectsToInsert.length > 0) {
      const { error: subjectError } = await supabase
        .from("mentor_subjects")
        .insert(subjectsToInsert);

      if (subjectError) {
        console.log("Insert mentor subjects error:", subjectError.message);
        setErrorMessage("Error saving subjects: " + subjectError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    sessionStorage.setItem("activeMode", "mentor");
    setCache("mentorSubjects", undefined);
    setCache("mentorRank", undefined);
    setCache("topMentors", undefined);
    navigate("/mentor-dashboard", { replace: true });
  };

  return (
    <div className={style.profileContainer}>
      <div className={style.profileCard}>
        <h2>NTUConnect</h2>
        <h1>Complete Mentor Profile</h1>

        <form className={style.form} onSubmit={handleSubmit}>
          {/* PROFILE IMAGE */}
          <div className={style.inputDiv} style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
            <UploadImage
              onUpload={async (path) => {
                setProfileImage(path);
                // Also update the profile picture in the database if they change it here
                const { data: user } = await supabase.auth.getUser();
                if (user.user) {
                  await supabase.from("profile").update({ profile_picture: path }).eq("id", user.user.id);
                }
              }}
              currentImage={profileImage}
              previewUrl={signedUrl}
            />
          </div>

          {/* NAME */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Full Name</label>
            <input type="text" value={name} disabled />
          </div>

          {/* EMAIL */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Email</label>
            <input type="email" value={email} disabled />
          </div>

          {/* DESCRIPTION */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Bio / Description</label>
            <textarea
              placeholder="Tell us about yourself and the subjects you're good at..."
              value={description}
              required
              rows={4}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
            />
          </div>

          {/* EXPERT SUBJECTS */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Expert Subjects (Exactly 3)</label>
            <div className={style.wrapper}>
              <SubjectSearch
                onChange={setExpertSubjects}
                initialSubjects={expertSubjects}
                maxSubjects={3}
              />
            </div>
            {expertSubjects.length !== 3 && (
              <p style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "5px" }}>
                You must select exactly 3 subjects. (Selected: {expertSubjects.length})
              </p>
            )}
            {expertSubjects.some((s) => difficultSubjects.includes(s)) && (
              <p style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "5px" }}>
                You cannot select your difficult subjects ({difficultSubjects.filter(s => expertSubjects.includes(s)).join(", ")}) as expert subjects.
              </p>
            )}
          </div>

          {/* ERROR DISPLAY */}
          {errorMessage && <p className={style.error}>{errorMessage}</p>}

          {/* BUTTON */}
          <button
            type="submit"
            className={style.submitBtn}
            disabled={loading || expertSubjects.length !== 3 || expertSubjects.some((s) => difficultSubjects.includes(s))}
          >
            {loading ? "Saving..." : mentorExists ? "Update Mentor Profile" : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MentorProfileCompletion;

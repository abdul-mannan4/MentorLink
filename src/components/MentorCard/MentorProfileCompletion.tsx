import React, { useEffect, useState } from "react";
import style from "../../Screens/Authentication/Profile.module.css";
import type { ChangeEvent } from "react";
import { supabase } from "../../supabase-client";
import { useNavigate } from "react-router-dom";

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

  const signedUrl = useSignedImage(profileImage);

  // ================= GET USER & PROFILE =================
  useEffect(() => {
    const getProfileData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      setEmail(userData.user.email || "");

      // Fetch profile
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (error) {
        console.log("Profile error:", error.message);
        return;
      }

      if (data) {
        setName(data.name || "");
        setProfileImage(data.profile_picture || "");
      }
    };

    getProfileData();
  }, []);

  // ================= SAVE MENTOR PROFILE =================
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (expertSubjects.length !== 3) {
      console.error("Please select exactly 3 subjects.");
      return;
    }

    if (!description.trim()) {
      console.error("Please provide a description (bio).");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      console.log("No user found");
      setLoading(false);
      return;
    }

    // INSERT MENTOR RECORD
    const { error: mentorError } = await supabase.from("mentor").upsert([
      {
        mentor_id: userData.user.id,
        Description: description,
        no_of_replies: 0,
        progress: "0",
        rating: 0,
      },
    ]);

    if (mentorError) {
      console.log("Error inserting mentor:", mentorError.message);
      console.error("Error saving mentor profile: " + mentorError.message);
      setLoading(false);
      return;
    }

    // DELETE OLD SUBJECTS (if any) AND INSERT NEW ONES
    const { error: deleteError } = await supabase
      .from("mentor_subjects")
      .delete()
      .eq("mentor_id", userData.user.id);

    if (deleteError) {
      console.log("Delete subjects error:", deleteError.message);
      console.error("Error preparing subjects: " + deleteError.message);
      setLoading(false);
      return;
    }

    const subjectsToInsert = expertSubjects.map((subject) => ({
      mentor_id: userData.user.id,
      course_name: subject,
      marks: -1,
    }));

    const { error: subjectError } = await supabase
      .from("mentor_subjects")
      .insert(subjectsToInsert);

    if (subjectError) {
      console.log("Insert mentor subjects error:", subjectError.message);
      console.error("Error saving subjects: " + subjectError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/mentor-dashboard");
  };

  return (
    <div className={style.profileContainer}>
      <div className={style.profileCard}>
        <h2>MentorLink</h2>
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
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", outline: "none" }}
            />
          </div>

          {/* EXPERT SUBJECTS */}
          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Expert Subjects (Exactly 3)</label>
            <div className={style.wrapper}>
              <SubjectSearch
                onChange={setExpertSubjects}
                initialSubjects={expertSubjects}
              />
            </div>
            {expertSubjects.length !== 3 && (
              <p style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "5px" }}>
                You must select exactly 3 subjects. (Selected: {expertSubjects.length})
              </p>
            )}
          </div>

          {/* BUTTON */}
          <button type="submit" className={style.submitBtn} disabled={loading || expertSubjects.length !== 3}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MentorProfileCompletion;

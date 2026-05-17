import React, { useEffect, useState } from "react";
import style from "./Profile.module.css";
import type { ChangeEvent } from "react";
import { supabase } from "../supabase-client";
import { useNavigate } from "react-router-dom";
import UploadImage from "./imageUpload";
import { useSignedImage } from "../Hooks/UseScrollRevealHook/useSignedImage";
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

  const [profileImage, setProfileImage] = useState<string>("");

  const signedUrl = useSignedImage(profileImage);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user?.email);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const getProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) return;
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
        setUsername(data.username || "");
        setDepartment(data.department || "");
        setBatch(data.batch || "");
        setTechnology(data.technology || "");
        // setSubject1(data.subject1 || "");
        // setSubject2(data.subject2 || "");
        // setSubject3(data.subject3 || "");
        setProfileImage(data.profile_image || "");
      }
    };
    getProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.log("No user Found");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("profile").insert([
      {
        id: userData.user.id,
        name:name,
        user_name:username,
        profile_picture: signedUrl,
        university_email: userData.user.email,
        university_name:university,
        department:department,
        technology:technology,
        batch:batch,
      },
    ]);

    await supabase.from("student_subject").insert([{
        
    }])
    if (error) {
      console.log(error.message);
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const insertSubject = async (e: React.FormEvent<HTMLFormElement>) => {
        const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.log("No user Found");
      setLoading(false);
      return;
    }

    const subjectToINsert=  difficultSubjects.map((subject)=>({
          student_id:userData?.user.id,
          course_name:subject
  }))

  const { data, error } = await supabase
    .from('student_subjects')
    .insert(subjectToINsert);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Inserted:', data);
  }
};

  return (
    <div className={style.profileContainer}>
      <div className={style.profileCard}>
        <h2>MentorLink</h2>
        <h1>Complete Your Profile</h1>

        <form action="" className={style.form} onSubmit={(e)=>{
          e.preventDefault();
          handleSubmit(e);
          insertSubject(e)
        }}>
          <UploadImage
            onUpload={(path) => {
              console.log("Url: ", path);
              setProfileImage(path);
            }}
            currentImage={profileImage}
            previewUrl={signedUrl}

          />

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              name="name"
              value={name}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value);
              }}
            />
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Email</label>
            <input type="email" placeholder="Email" value={email} disabled required />
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]} >UserName</label>

            <input
              type="text"
              placeholder="UserName"
              required
              name="username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
              }}
            />
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>University</label>

            <input
              type="text"
              placeholder="University Name"
              name="universityName"
              value={"National Textile University"}
              disabled
              required
            />
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Department</label>

            <select
              name="department"
              id="department"
              required
              value={department}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setDepartment(e.target.value);
              }}
            >
              <option value ="" hidden >Select Department</option>
              <option value="DCS" >
                Computer Science
              </option>
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

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Batch</label>

            <input
              type="text"
              placeholder="e.g. 2023"
              name="batch"
              value={batch}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setBatch(e.target.value);
              }}
            />
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Technology</label>

            <select
              name="technology"
              id="technology"
              required
              value={technology}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setTechnology(e.target.value);
              }}
            >

              <option value ="" hidden  >Select Technology</option>
              <option value="CS" >
                CS
              </option>
              <option value="SE">SE</option>
              <option value="AI">AI</option>
              <option value="CET">CET</option>
            </select>
          </div>

          <div className={style.inputDiv}>
            <label className={style["input-heading"]}>Difficult Subjects</label>

            <div className={style.wrapper}>
              <SubjectSearch onChange={setDifficultSubjects} />
            </div>
          </div>
          <button
            type="submit"
            className={loading ? "spinner" : style.submitBtn}
          >
            {loading ? <span className="spinnner"></span> : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
export default Profile;

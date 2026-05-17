import React, { useState } from "react";
import ModeButton from "../../../components/ModeButton/ModeButton";
import styles from "./StudentPageOne.module.css";
import userIcon from "../../../assets/userIcon.svg";
const StudentPageOne = () => {
  const projectName = "MentroLink";
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  return (
    <div className={styles.TopContainer}>
      {/* Navbar */}

      <nav className={styles.LandingNavbar}>
        <div className={styles.logo}>
          <span className={styles.dot}></span>
          <span className={styles.logoName}>
            {projectName[0]}
            <span className={styles["logo-text-rest"]}>
              {projectName.slice(1)}
            </span>
          </span>
        </div>

        <div className={`${styles.navActions}`}>
          {/* <ModeButton /> */}
          <input
            type="text"
            placeholder="Search Mentor..."
            className={styles.searchBar}
          />
          <div className={styles.profileSideBar}>
            <img
              src={userIcon}
              alt="profile"
              className={styles.profilePic}
              onClick={() => setOpen((prev) => !prev)}
            />
            {open && (
              <div className={styles.sideBar}>
                <p>Hello</p>
                <p>Hello</p>
                <p>Hello</p>
                <p>Hello</p>
                <p>Hello</p>
              </div>
            )}
          </div>

          {/* <button className={styles.buttonSignIn}>Sign In</button>
          <button className={styles.buttonSignUp}>Sign Up</button> */}
        </div>
      </nav>
    </div>
  );
};

export default StudentPageOne;

// import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/WhyCard/WhyCard";
import style from "../LandingPage/LandingPage.module.css";
import WorkingGuideCard from "../../components/WorkingGuideCard/WorkingGuideCard";
// import { useTheme } from "../../ThemeProvider/ThemeProvider";
import useScrollReveal from "../../Hooks/UseScrollRevealHook/UseScrollHook";
import ModeButton from "../../components/ModeButton/ModeButton";
import Auth from "../Authentication/Auth";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

const LandingPage = () => {
  const projectName = "MENTORLINK";
  const userNumber = "12,567";
  const navigate = useNavigate();
  useScrollReveal();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/student", { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  // const { isDark, toggleTheme } = useTheme();
  // const [isDark, setIsDark] = useState(true);
  //For By Default dark mode
  // useEffect(() => {
  //   document.documentElement.setAttribute("data-theme", "dark");
  // }, []);
  // Apply data-theme to <html> so all CSS variables flip at once
  // const handleMode = () => {
  //   setIsDark((prev) => {
  //     const next = !prev;
  //     document.documentElement.setAttribute(
  //       "data-theme",
  //       next ? "dark" : "light",
  //     );
  //     return next;
  //   });
  // };

  // useEffect(() => {
  //   document.documentElement.setAttribute(
  //     "data-theme",
  //     isDark ? "dark" : "light",
  //   );
  // }, [isDark]);

  // Scroll-reveal animation
  // useEffect(() => {
  //   const observerOptions = { threshold: 0.1 };
  //   const observer = new IntersectionObserver((entries) => {
  //     entries.forEach((entry) => {
  //       if (entry.isIntersecting) {
  //         entry.target.classList.add(style.show);
  //       }
  //       //To create the impact of fade out while move scrolling upward
  //       // else {
  //       //   entry.target.classList.remove("show");
  //       // }
  //     });
  //   }, observerOptions);

  //   const timer = setTimeout(() => {
  //     document
  //       .querySelectorAll(`.hidden`)
  //       .forEach((el) => observer.observe(el));
  //   }, 10);

  //   return () => {
  //     clearTimeout(timer);
  //     observer.disconnect();
  //   };
  // }, []);

  return (
    <>
      <div className={`${style.TopContainer} ${showAuth ? style.blur : ""}`}>
        {/* Navbar */}

        <nav className={style.LandingNavbar}>
          <div className={style.logo}>
            <span className={style.dot}></span>
            <span className={style.logoName}>
              {projectName[0]}
              <span className={style["logo-text-rest"]}>
                {projectName.slice(1)}
              </span>
            </span>
          </div>

          <div className={`${style.navActions}`}>
            {/* <button
            className={style.Mode}
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            <span
              className={`${style.modeButton} ${
                isDark ? style.modeButtonDark : ""
              }`}
            >
              {isDark ? "🌤️" : "🌙"}
            </span>
          </button> */}
            <ModeButton />
            <button
              className={style.buttonSignIn}
              onClick={() => setShowAuth(true)}
            >
              Sign In
            </button>
            <button
              className={style.buttonSignUp}
              onClick={() => setShowAuth(true)}
            >
              Sign Up
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className={`${style.heroSection} hidden`}>
          <p className={`${style.heroSectionBadge} hidden`}>
            University-verified mentorship platform
          </p>
          <p className={`${style.firstLineHero} hidden`}>
            Connect &amp; Learn.
          </p>
          <p className={`${style.secondLineHero} hidden`}>
            Grow With Verified Mentors.
          </p>
          <p className={`${style.thirdLineHero} hidden`}>
            A University-based mentorship platform where students get answers,
            guidance, and real academic support.
          </p>

          <div className={`${style.heroButton} hidden`}>
            <button
              className={style.heroButton1}
              onClick={() => setShowAuth(true)}
              // onClick={() =>
              //   navigate("/Auth", {
              //     // replace: true,
              //     // state: { isDark: isDark },
              //   })
              // }
            >
              Get Started
            </button>
            <button className={style.heroButton2}>Browse Mentors</button>
          </div>

          <div className={`${style.lineWrapper} hidden`}>
            <div className={style.innerLine}></div>
          </div>

          <div className={`${style.statsSection} hidden`}>
            <div className={style.statsContainer}>
              <div className={`${style.statItem} hidden`}>
                <p className={`${style.statNumber} ${style.statPrimary}`}>
                  12k+
                </p>
                <p className={style.statLabel}>Students</p>
              </div>

              <div className={`${style.statItem} hidden`}>
                <p className={`${style.statNumber} ${style.statSecondary}`}>
                  3.4k+
                </p>
                <p className={style.statLabel}>Mentors</p>
              </div>

              <div className={`${style.statItem} hidden`}>
                <p className={`${style.statNumber} ${style.statTertiary}`}>
                  98%
                </p>
                <p className={style.statLabel}>Satisfaction</p>
              </div>

              <div className={`${style.statItem} hidden`}>
                <p className={`${style.statNumber} ${style.statPrimary}`}>
                  50+
                </p>
                <p className={style.statLabel}>Universities</p>
              </div>
            </div>
          </div>
        </div>

        {/* Why section */}
        <div className={`${style.featuresSection} hidden`}>
          <p className={`${style.featureSectionLine1} hidden`}>
            WHY {projectName}
          </p>
          <p className={`${style.featureSectionLine2} hidden`}>
            Everything you need to learn smarter
          </p>

          <div className={`${style.cards} hidden`}>
            <Card
              icon="👤"
              iconBg="#E6F1FB"
              title="Verified university students"
              description="Connect safely with genuine students from your university ecosystem."
              iconColor="#185FA5"
              link="#"
            />
            <Card
              icon="🎓"
              iconBg="#EEEDFE"
              title="Expert mentors"
              description="Get guidance from seniors who've walked the same academic path."
              iconColor="#7F77DD"
              link="#"
            />
            <Card
              icon="💬"
              iconBg="#FAEEDA"
              title="Real-time support"
              description="Ask questions and get answers when you need them most."
              iconColor="#BA7517"
              link="#"
            />
          </div>
        </div>

        {/* How it works */}
        <div className={`${style.workingGuideSection} hidden`}>
          <p className={`${style.featureSectionLine1} hidden`}>HOW IT WORKS</p>
          <p className={`${style.featureSectionLine2} hidden`}>
            Up and running in minutes
          </p>

          <div className={`${style.workingGuideCards} hidden`}>
            <WorkingGuideCard
              noIcon="1"
              noBg="#185FA5"
              title="Create Account"
              description="Sign up with your university email in seconds."
              noColor="#FFFFFF"
            />
            <WorkingGuideCard
              noIcon="2"
              noBg="#7F77DD"
              title="Match With Mentor"
              description="We find you the best mentors in the institution."
              noColor="#FFFFFF"
            />
            <WorkingGuideCard
              noIcon="3"
              noBg="#EF9F27"
              title="Start Learning"
              description="Chat, call, or schedule sessions anytime."
              noColor="#000000"
            />
          </div>
        </div>

        {/* CTA */}
        <div className={`${style.accountCreation} hidden`}>
          <p className={`${style.userNumberDisplay} hidden`}>
            &nbsp;Join {userNumber}+ students&nbsp;
          </p>

          <p
            className={`${style.featureSectionLine2} hidden`}
            style={{ color: "#E6F1FB" }}
          >
            Start learning smarter today.
          </p>

          <p
            className={`${style.userNumberDisplay} hidden`}
            style={{ fontWeight: 300, fontSize: "1rem" }}
          >
            No payment required. Get matched with a mentor in under 5 minutes.
          </p>

          <button
            className={`${style.heroButton1} ${style.accountButton} hidden`}
            onClick={() => setShowAuth(true)}
          >
            Create Account
          </button>
        </div>

        {/* Footer */}
        <footer className={`${style.footer} hidden`}>
          <div className={style.footerLeftSide}>
            <div className={style.logo}>
              <span className={style.dot}></span>
              <span className={style.logoName} style={{ fontSize: "0.75rem" }}>
                <a
                  href="#"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {projectName}
                </a>
              </span>
            </div>

            <p
              className={style.featureSectionLine1}
              style={{ fontSize: "0.75rem" }}
            >
              &copy; {new Date().getFullYear()} Mentorlink. All rights reserved.
            </p>
          </div>

          <div className={style.footerRightSide}>
            <button className={`${style.buttonSignIn} ${style.footerButton}`}>
              Privacy
            </button>
            <button className={`${style.buttonSignIn} ${style.footerButton}`}>
              Terms
            </button>
            <button className={`${style.buttonSignIn} ${style.footerButton}`}>
              Contact
            </button>
          </div>
        </footer>
      </div>
      {showAuth && (
        <div className={style.overlay}>
          <div onClick={(e) => e.stopPropagation()}>
            <Auth onClose={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default LandingPage;

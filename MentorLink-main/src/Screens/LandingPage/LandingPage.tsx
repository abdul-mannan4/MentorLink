// import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/WhyCard/WhyCard";
import style from "../LandingPage/LandingPage.module.css";
import WorkingGuideCard from "../../components/WorkingGuideCard/WorkingGuideCard";
// import { useTheme } from "../../ThemeProvider/ThemeProvider";
import useScrollReveal from "../../Hooks/UseScrollRevealHook/UseScrollHook";
import ModeButton from "../../components/ModeButton/ModeButton";
import Auth from "../Authentication/Auth";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../../supabase-client";
import userIcon from "../../assets/userIcon.svg";
import logoIcon from "../../assets/logo.svg";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TargetIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5.5 5.5 0 0 0 7 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
  </svg>
);

const HelpCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

interface MentorData {
  mentor_id: string;
  name: string | null;
  profile_picture: string | null;
  subjects: string[];
  description: string;
}

const MentorRowCard = ({ mentor, onConnect }: { mentor: MentorData; onConnect: () => void }) => {
  // profile_picture is already a full public https:// URL from the /api/mentors/browse endpoint
  const avatarSrc = (mentor.profile_picture && mentor.profile_picture !== "null") ? mentor.profile_picture : userIcon;
  const displayName = mentor.name || "Anonymous Mentor";

  return (
    <div className={style.browseCard}>
      <div className={style.browseCardHeader}>
        <img
          src={avatarSrc}
          alt={displayName}
          className={style.browseAvatar}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = userIcon;
          }}
        />
        <div className={style.browseInfo}>
          <h4 className={style.browseName}>{displayName}</h4>
          <p className={style.browseDesc}>{mentor.description}</p>
        </div>
      </div>
      <div className={style.browseSubjects}>
        {mentor.subjects.length > 0 ? (
          mentor.subjects.map((sub, index) => (
            <span key={index} className={style.browseSubjectBadge}>{sub}</span>
          ))
        ) : (
          <span className={style.browseNoSubject}>No expertise subjects listed</span>
        )}
      </div>
      <button className={style.browseConnectBtn} onClick={onConnect}>Connect</button>
    </div>
  );
};

const LandingPage = () => {
  const projectName = "NTUConnect";
  const userNumber = "3,500";
  const navigate = useNavigate();
  useScrollReveal();
  const [showAuth, setShowAuth] = useState(false);
  const [showMentorsModal, setShowMentorsModal] = useState(false);
  const [mentorsList, setMentorsList] = useState<MentorData[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [connectToast, setConnectToast] = useState(false);
  const connectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mentorSearch, setMentorSearch] = useState("");

  // Live client-side filter — no extra API call
  const filteredMentors = useMemo(() => {
    const q = mentorSearch.trim().toLowerCase();
    if (!q) return mentorsList;
    return mentorsList.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.subjects.some((s) => s.toLowerCase().includes(q))
    );
  }, [mentorsList, mentorSearch]);

  const handleConnectClick = () => {
    if (connectToastTimerRef.current) clearTimeout(connectToastTimerRef.current);
    setConnectToast(true);
    connectToastTimerRef.current = setTimeout(() => setConnectToast(false), 3500);
  };

  const handleOpenMentorsModal = async () => {
    setShowMentorsModal(true);
    if (mentorsList.length > 0) return; // Already loaded, don't reload
    setLoadingMentors(true);
    try {
      const res = await fetch(`${API_URL}/mentors/browse`);
      if (!res.ok) throw new Error("Failed to load mentors");
      const json = await res.json();
      setMentorsList(json.data || []);
    } catch (err) {
      console.error("Error fetching mentors:", err);
      setMentorsList([]);
    } finally {
      setLoadingMentors(false);
    }
  };

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
      <div className={`${style.TopContainer} ${(showAuth || showMentorsModal) ? style.blur : ""}`}>
        {/* Navbar */}

        <nav className={style.LandingNavbar}>
          <div className={style.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
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
            <button className={style.heroButton2} onClick={handleOpenMentorsModal}>Browse Mentors</button>
          </div>

          <div className={`${style.lineWrapper} hidden`}>
            <div className={style.innerLine}></div>
          </div>

          <div className={`${style.highlightsSection} hidden`}>
            <h3 className={style.highlightsHeading}>Core Platform Features</h3>
            <div className={style.highlightsGrid}>
              <div className={`${style.highlightCard} hidden`}>
                <div className={style.highlightIconWrapper} style={{ backgroundColor: "rgba(24, 95, 165, 0.1)", color: "var(--primary)" }}>
                  <ShieldIcon />
                </div>
                <h4 className={style.highlightTitle}>NTU Verified</h4>
                <p className={style.highlightDescription}>Safe, exclusive network verified via student emails.</p>
              </div>

              <div className={`${style.highlightCard} hidden`}>
                <div className={style.highlightIconWrapper} style={{ backgroundColor: "rgba(127, 119, 221, 0.1)", color: "var(--accent)" }}>
                  <TargetIcon />
                </div>
                <h4 className={style.highlightTitle}>Course Match</h4>
                <p className={style.highlightDescription}>Connect with senior students who took your exact courses.</p>
              </div>

              <div className={`${style.highlightCard} hidden`}>
                <div className={style.highlightIconWrapper} style={{ backgroundColor: "rgba(239, 159, 39, 0.1)", color: "var(--highlight)" }}>
                  <LightbulbIcon />
                </div>
                <h4 className={style.highlightTitle}>Quick Q&A</h4>
                <p className={style.highlightDescription}>Post your academic questions and receive verified help.</p>
              </div>

              <div className={`${style.highlightCard} hidden`}>
                <div className={style.highlightIconWrapper} style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--emerald)" }}>
                  <MessageSquareIcon />
                </div>
                <h4 className={style.highlightTitle}>Private DM</h4>
                <p className={style.highlightDescription}>Start real-time chat with matched mentors instantly.</p>
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
              icon={<UsersIcon />}
              iconBg="#E6F1FB"
              title="Verified university students"
              description="Connect safely with genuine students from your university ecosystem."
              iconColor="#185FA5"
              link="#"
            />
            <Card
              icon={<GraduationCapIcon />}
              iconBg="#EEEDFE"
              title="Expert mentors"
              description="Get guidance from seniors who've walked the same academic path."
              iconColor="#7F77DD"
              link="#"
            />
            <Card
              icon={<HelpCircleIcon />}
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
        {/* Footer */}
        <footer className={`${style.footer} hidden`}>
          <div className={style.footerLeftSide}>
            <div className={style.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" style={{ height: "24px", marginRight: "6px" }} />
              <span className={style.logoName} style={{ fontSize: "0.75rem" }}>
                <a
                  href="#"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {projectName}
                </a>
              </span>
            </div>
          </div>

          <div className={style.footerMiddleSide}>
            <span className={style.footerSectionTitle}>Developers</span>
            <div className={style.devCardRow}>
              <div className={style.devCard}>
                <span className={style.devCardName}>Abdul Hannan Ibrahim</span>
                <span className={style.devCardRole}>Project Lead & Developer</span>
                <a href="mailto:hannanibrahim609@gmail.com" className={style.devCardEmail}>hannanibrahim609@gmail.com</a>
              </div>
              <div className={style.devCard}>
                <span className={style.devCardName}>Abdul Mannan Ibrahim</span>
                <span className={style.devCardRole}>Full Stack Developer</span>
                <a href="mailto:mannanibrahim321@gmail.com" className={style.devCardEmail}>mannanibrahim321@gmail.com</a>
              </div>
              <div className={style.devCard}>
                <span className={style.devCardName}>Muhammad Hamza</span>
                <span className={style.devCardRole}>Backend Developer</span>
                <a href="mailto:hamzafaiz635@gmail.com" className={style.devCardEmail}>hamzafaiz635@gmail.com</a>
              </div>
            </div>
          </div>

          <div className={style.footerRightSide}>
            <p
              className={style.featureSectionLine1}
              style={{ fontSize: "0.75rem" }}
            >
              &copy; {new Date().getFullYear()} NTUConnect. All rights reserved.
            </p>
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
      {showMentorsModal && (
        <div className={style.modalOverlay} onClick={() => setShowMentorsModal(false)}>
          <div className={style.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={style.modalHeader}>
              <div className={style.modalHeaderLeft}>
                <h2>Browse Mentors</h2>
                {!loadingMentors && mentorsList.length > 0 && (
                  <span className={style.mentorCount}>
                    {filteredMentors.length === mentorsList.length
                      ? `${mentorsList.length} mentor${mentorsList.length !== 1 ? "s" : ""}`
                      : `${filteredMentors.length} of ${mentorsList.length}`}
                  </span>
                )}
              </div>
              <button className={style.closeModalBtn} onClick={() => setShowMentorsModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {!loadingMentors && mentorsList.length > 0 && (
              <div className={style.mentorSearchBar}>
                <svg className={style.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="mentor-search-input"
                  type="text"
                  placeholder="Search by name, subject or expertise…"
                  className={style.mentorSearchInput}
                  value={mentorSearch}
                  onChange={(e) => setMentorSearch(e.target.value)}
                  autoComplete="off"
                />
                {mentorSearch && (
                  <button className={style.searchClearBtn} onClick={() => setMentorSearch("")} aria-label="Clear search">✕</button>
                )}
              </div>
            )}
            {/* Sign-in required toast — outside scrollable body so it's always visible */}
            {connectToast && (
              <div className={style.connectToast}>
                <span className={style.connectToastIcon}>🔒</span>
                <div className={style.connectToastContent}>
                  <strong>Sign in required</strong>
                  <p>Please sign in to connect with a mentor and start learning.</p>
                </div>
                <button className={style.connectToastClose} onClick={() => setConnectToast(false)}>✕</button>
              </div>
            )}
            <div className={style.modalBody}>

              {loadingMentors ? (
                <div className={style.loadingMentors}>
                  <div className={style.spinner}></div>
                  <p>Loading mentors...</p>
                </div>
              ) : mentorsList.length === 0 ? (
                <p className={style.noMentors}>No mentors registered yet.</p>
              ) : filteredMentors.length === 0 ? (
                <div className={style.noSearchResults}>
                  <span className={style.noSearchIcon}>🔍</span>
                  <p>No mentors match <strong>"{mentorSearch}"</strong></p>
                  <button className={style.clearSearchBtn} onClick={() => setMentorSearch("")}>Clear search</button>
                </div>
              ) : (
                <div className={style.browseGrid}>
                  {filteredMentors.map((mentor) => (
                    <MentorRowCard key={mentor.mentor_id} mentor={mentor} onConnect={handleConnectClick} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LandingPage;

import React, { useEffect, useState } from "react";
import Card from "../../components/WhyCard/WhyCard";
import "./LandingPage.css";
import WorkingGuideCard from "../../components/WorkingGuideCard/WorkingGuideCard";

const LandingPage = () => {
  const projectName = "MENTORLINK";
  const userNumber = "12,567";
  const [isDark, setIsDark] = useState(true);

  //For By Default dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Apply data-theme to <html> so all CSS variables flip at once
  const handleMode = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.setAttribute(
        "data-theme",
        next ? "dark" : "light",
      );
      return next;
    });
  };

  // Scroll-reveal animation
  useEffect(() => {
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
        //To create the ipact of fade out while move scrolling upward
        // else {
        //   entry.target.classList.remove("show");
        // }
      });
    }, observerOptions);

    const timer = setTimeout(() => {
      document
        .querySelectorAll(".hidden")
        .forEach((el) => observer.observe(el));
    }, 10);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="TopContainer">
      {/* Navbar */}
      <nav className="LandingNavbar">
        <div className="logo">
          <span className="dot"></span>
          <span className="logoName">
            {projectName[0]}
            <span className="logo-text-rest">{projectName.slice(1)}</span>
          </span>
        </div>

        <div className={`navActions `}>
          <button
            className="Mode"
            onClick={handleMode}
            aria-label="Toggle dark mode"
          >
            <span className={`modeButton ${isDark ? "modeButtonDark" : ""}`}>
              {isDark ? "🌤️" : "🌙"}
            </span>
          </button>
          <button className="buttonSignIn">Sign In</button>
          <button className="buttonSignUp">Sign Up</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="heroSection hidden">
        <p className="heroSectionBadge hidden">
          University-verified mentorship platform
        </p>
        <p className="firstLineHero hidden">Connect &amp; Learn.</p>
        <p className="secondLineHero hidden">Grow With Verified Mentors.</p>
        <p className="thirdLineHero hidden">
          A University-based mentorship platform where students get answers,
          guidance, and real academic support.
        </p>
        <div className="heroButton hidden">
          <button className="heroButton1">Get Started</button>
          <button className="heroButton2">Browse Mentors</button>
        </div>
        <div className="lineWrapper hidden">
          <div className="innerLine"></div>
        </div>
        <div className="statsSection hidden">
          <div className="statsContainer">
            <div className="statItem hidden">
              <p className="statNumber statPrimary">12k+</p>
              <p className="statLabel">Students</p>
            </div>
            <div className="statItem hidden">
              <p className="statNumber statSecondary">3.4k+</p>
              <p className="statLabel">Mentors</p>
            </div>
            <div className="statItem hidden">
              <p className="statNumber statTertiary">98%</p>
              <p className="statLabel">Satisfaction</p>
            </div>
            <div className="statItem hidden">
              <p className="statNumber statPrimary">50+</p>
              <p className="statLabel">Universities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Why section */}
      <div className="featuresSection hidden">
        <p className="featureSectionLine1 hidden">WHY {projectName}</p>
        <p className="featureSectionLine2 hidden">
          Everything you need to learn smarter
        </p>
        <div className="cards hidden">
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
      <div className="workingGuideSection hidden">
        <p className="featureSectionLine1 hidden">HOW IT WORKS</p>
        <p className="featureSectionLine2 hidden">Up and running in minutes</p>
        <div className="workingGuideCards hidden">
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
      <div className="accountCreation hidden">
        <p className="userNumberDisplay hidden">
          &nbsp;Join {userNumber}+ students&nbsp;
        </p>
        <p className="featureSectionLine2 hidden" style={{ color: "#E6F1FB" }}>
          Start learning smarter today.
        </p>
        <p
          className="userNumberDisplay hidden"
          style={{ fontWeight: 300, fontSize: "1rem" }}
        >
          No payment required. Get matched with a mentor in under 5 minutes.
        </p>
        <button className="heroButton1 accountButton hidden">
          Create Account
        </button>
      </div>

      {/* Footer */}
      <footer className="footer hidden">
        <div className="footerLeftSide">
          <div className="logo">
            <span className="dot"></span>
            <span className="logoName" style={{ fontSize: "0.75rem" }}>
              <a href="#" style={{ textDecoration: "none", color: "inherit" }}>
                {projectName}
              </a>
            </span>
          </div>
          <p className="featureSectionLine1" style={{ fontSize: "0.75rem" }}>
            &copy; {new Date().getFullYear()} Mentorlink. All rights reserved.
          </p>
        </div>
        <div className="footerRightSide">
          <button className="buttonSignIn footerButton">Privacy</button>
          <button className="buttonSignIn footerButton">Terms</button>
          <button className="buttonSignIn footerButton">Contact</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

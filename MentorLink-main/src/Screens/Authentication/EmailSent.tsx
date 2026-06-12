// EmailSent.tsx — Shows "check your email" page ONLY for newly registered users
import { useEffect, useState } from "react";
import { supabase } from "../../supabase-client";
import { useLocation, useNavigate } from "react-router-dom";
import style from "./EmailVerified.module.css";

function EmailSent() {
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [blocked, setBlocked] = useState(false); // true if user already has session

  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email as string | undefined;

  useEffect(() => {
    // ─── GUARD: If user already has a valid session, they should NOT be here ───
    // They are already signed in — redirect to the student dashboard.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Signed-in user tried to reach email-sent — send them away.
        setBlocked(true);
        navigate("/student", { replace: true });
      }
    });

    // Also guard against signing in from ANOTHER tab while this page is open.
    // But do NOT auto-navigate away just because a session exists in storage
    // (that bug was causing this page to redirect immediately).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // User confirmed their email from the email link (Tab 2) and this tab
        // detected the auth state change — navigate to verified page.
        navigate("/email-verified");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // If no email in location state AND not a freshly-navigated-here page, redirect to auth
  useEffect(() => {
    if (!email) {
      navigate("/auth", { replace: true });
    }
  }, [email, navigate]);

  async function handleResendEmail() {
    if (!email) return;
    setResendMessage("");
    setResendError("");
    setResendLoading(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setResendLoading(false);

    if (error) {
      setResendError(error.message);
    } else {
      setResendMessage("✅ Email resent! Check your inbox.");
    }
  }

  if (blocked || !email) return null;

  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyCard}>
        <h2 className={style.brand}>MentorLink</h2>

        {/* Envelope icon */}
        <div className={style.successWrapper}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
        </div>

        <h3>Check your inbox!</h3>

        <p className={style.message}>
          We've sent a verification link to your student email. Please check
          your inbox and click the link to activate your account.
        </p>

        <div className={style.emailBox}>📩 {email}</div>

        <p className={style.note}>
          Didn't receive the email? Check your spam / junk folder, or wait 30
          seconds before requesting again.
        </p>

        <button
          className={resendLoading ? style.spinner : style.resendBtn}
          onClick={handleResendEmail}
          disabled={resendLoading}
          id="btn-resend-email"
        >
          {resendLoading ? (
            <span className={style.spinnner}></span>
          ) : (
            "Resend Email"
          )}
        </button>

        {resendMessage && (
          <p className={style.successText}>{resendMessage}</p>
        )}
        {resendError && <p className={style.errorText}>{resendError}</p>}

        <button
          className={style.backLink}
          onClick={() => navigate("/auth")}
          id="btn-back-to-auth"
        >
          ← Back to Sign In
        </button>
      </div>
    </div>
  );
}

export default EmailSent;

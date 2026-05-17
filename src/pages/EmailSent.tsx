// EmailVerifyCard.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import { useLocation, useNavigate } from "react-router-dom";

import style from "./EmailVerified.module.css";

function ConfirmEmail() {
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email;
// EmailSent.tsx
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/email-verified"); // ✅ Tab 1 bhi navigate ho jayega
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);

  async function handleResendEmail() {
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
      setResendMessage("Email resent!");
    }
  }

  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyCard}>
        <h2 className={style.brand}>MentorLink</h2>
        <h3>Verify your email address</h3>
        <p className={style.message}>
          We've sent a verification link to your Outlook Email. Please check your inbox
          and click the link to activate your account.
        </p>
        <div className={style.emailBox}>📩 {email}</div>
        <p className={style.note}>
          Didn't receive the email? Check spam/junk folder or wait a few seconds
          before requesting again.
        </p>
        <button
          className={`${resendLoading ? style.spinner : style.resendBtn}`}
          onClick={handleResendEmail}
          disabled={resendLoading}
        >
          {resendLoading ? (
            <span className={style.spinnner}></span>
          ) : (
            "Resend Email"
          )}
        </button>
        {resendMessage && <p className={style.successText}>{resendMessage}</p>}
        {resendError && <p className={style.errorText}>{resendError}</p>}
      </div>
    </div>
  );
}

export default ConfirmEmail;

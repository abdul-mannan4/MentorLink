
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase-client";
import style from "./EmailVerified.module.css";

function ConfirmEmail() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tokenHash = queryParams.get("token_hash");
    const error = queryParams.get("error");

    if (error) {
      setErrorMessage("Link expired. Please request a new one.");
      return;
    }

    if (tokenHash) {
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "signup",
      }).then(({ data, error }) => {
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        if (data.session) {
          setSessionReady(true);
        }
      });
    }
    else {
    // Tab 1 — token nahi, onAuthStateChange se wait karo
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setSessionReady(true); // ✅
          subscription.unsubscribe();
        }
      }
    );
  }
  }, []);

  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyCard}>
                <h2 className={style.brand}>MentorLink</h2>
        <div className={style.successWrapper}>
          <svg className={style.circleSvg} viewBox="0 0 52 52">
            {/* Circle */}
            <circle className={style.circle} cx="26" cy="26" r="22" />

            {/* Check mark */}
            <path className={style.check} d="M14 27 l8 8 l16 -16" />
          </svg>


        </div>
        <h3>Email Verified!</h3>
        <p className={style.message}>
          Your email has been confirmed. Let's set up your profile.
        </p>
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

        <button
          className={style.resendBtn}
          onClick={() => navigate("/profile")}
          disabled={!sessionReady}
        >
                    {sessionReady ? <>Complete Profile <span className={style.arrow}>→</span></> : errorMessage ? "Request new link" : "Setting up session..."}
        </button>
      </div>
    </div>
  );
}

export default ConfirmEmail;


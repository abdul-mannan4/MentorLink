import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
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
      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        })
        .then(({ data, error }) => {
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          if (data.session) {
            setSessionReady(true);
          }
        });
    } else {
      // No token_hash. Let's check if they are already signed in.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          // If they aren't signed in AND have no token, they shouldn't be on this page!
          // We will show an error instead of pretending it's verified.
          setErrorMessage("No verification session found. Please click the link in your email.");
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          setSessionReady(true);
          setErrorMessage(""); // Clear error if they sign in from another tab
          subscription.unsubscribe();
        }
      });
      
      return () => subscription.unsubscribe();
    }
  }, []);

  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyCard}>
        <h2 className={style.brand}>MentorLink</h2>
        
        {!errorMessage ? (
          <>
            <div className={style.successWrapper}>
              <svg className={style.circleSvg} viewBox="0 0 52 52">
                <circle className={style.circle} cx="26" cy="26" r="22" />
                <path className={style.check} d="M14 27 l8 8 l16 -16" />
              </svg>
            </div>
            <h3>Email Verified!</h3>
            <p className={style.message}>
              Your email has been confirmed. Let's set up your profile.
            </p>
          </>
        ) : (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <h3 style={{ color: '#ff4d4f' }}>Verification Required</h3>
            <p className={style.message} style={{ color: '#ff4d4f' }}>{errorMessage}</p>
          </div>
        )}

        <button
          className={style.resendBtn}
          onClick={() => navigate(errorMessage ? "/auth" : "/profile")}
          disabled={!errorMessage && !sessionReady}
        >
          {sessionReady ? (
            <>
              Complete Profile <span className={style.arrow}>→</span>
            </>
          ) : errorMessage ? (
            "Go back to Login"
          ) : (
            "Setting up session..."
          )}
        </button>
      </div>
    </div>
  );
}

export default ConfirmEmail;

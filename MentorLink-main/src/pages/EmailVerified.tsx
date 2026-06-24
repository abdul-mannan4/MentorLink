import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { realtimeSupabase } from "../supabase-client";
import style from "./EmailVerified.module.css";
import logoIcon from "../assets/logo.svg";

function ConfirmEmail() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const error = queryParams.get("error");
    return error ? "Verification link expired or already used. Please request a new one." : "";
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);

    const tokenHash = queryParams.get("token_hash");
    const type = queryParams.get("type") || "signup";
    
    // Check both query params and hash for errors
    const error = queryParams.get("error") || hashParams.get("error");
    const errorDescription = queryParams.get("error_description") || hashParams.get("error_description") || queryParams.get("error_msg");

    const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");

    if (error) {
      console.error("Verification error:", error, errorDescription);
      setErrorMessage(
        errorDescription || "Verification link expired or already used. Please request a new one."
      );
      return;
    }

    if (accessToken) {
      // Standard redirect: Supabase Auth redirect returns user session in the URL hash
      console.log("Setting session from URL hash...");
      realtimeSupabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        })
        .then(({ data, error: setSessionError }) => {
          if (setSessionError) {
            console.error("setSession error:", setSessionError.message);
            setErrorMessage(setSessionError.message);
            return;
          }
          if (data?.session) {
            // Persist session in localStorage so our custom supabase-client picks it up
            localStorage.setItem("sb-session", JSON.stringify(data.session));
            if (data.session.user) {
              localStorage.setItem("sb-user", JSON.stringify(data.session.user));
            }
            // Notify any other tabs that verification happened
            window.dispatchEvent(new StorageEvent("storage", {
              key: "sb-session",
              newValue: JSON.stringify(data.session),
              storageArea: localStorage,
            }));
            setSessionReady(true);
          } else {
            setErrorMessage("Verification complete but no session was created. Try signing in.");
          }
        });
    } else if (tokenHash) {
      // Direct token_hash verification
      console.log("Verifying token_hash OTP...");
      realtimeSupabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "recovery" | "email_change",
        })
        .then(({ data, error: verifyError }) => {
          if (verifyError) {
            console.error("verifyOtp error:", verifyError.message);
            setErrorMessage(
              verifyError.message.includes("expired") || verifyError.message.includes("invalid")
                ? "Verification link expired or already used. Please request a new one."
                : verifyError.message
            );
            return;
          }
          if (data?.session) {
            localStorage.setItem("sb-session", JSON.stringify(data.session));
            if (data.session.user) {
              localStorage.setItem("sb-user", JSON.stringify(data.session.user));
            }
            window.dispatchEvent(new StorageEvent("storage", {
              key: "sb-session",
              newValue: JSON.stringify(data.session),
              storageArea: localStorage,
            }));
            setSessionReady(true);
          } else {
            const existing = localStorage.getItem("sb-session");
            if (existing) {
              setSessionReady(true);
            } else {
              setErrorMessage("Verification complete but no session was created. Try signing in.");
            }
          }
        });
    } else {
      // Fallback: check if we already have an active session
      const existing = localStorage.getItem("sb-session");
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed?.access_token) {
            setSessionReady(true);
            return;
          }
        } catch {
          // ignore
        }
      }
      setErrorMessage("No verification token found. Please click the link in your email.");
    }
  }, []);

  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyCard}>
        <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
        <h2 className={style.brand}>NTUConnect</h2>
        <div className={style.successWrapper}>
          <svg className={style.circleSvg} viewBox="0 0 52 52">
            <circle className={style.circle} cx="26" cy="26" r="22" />
            <path className={style.check} d="M14 27 l8 8 l16 -16" />
          </svg>
        </div>
        {!errorMessage ? (
          <>
            <h3>Email Verified!</h3>
            <p className={style.message}>
              Your email has been confirmed. Let's set up your profile.
            </p>
          </>
        ) : (
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <h3 style={{ color: "#ff4d4f" }}>Verification Required</h3>
            <p className={style.message} style={{ color: "#ff4d4f" }}>{errorMessage}</p>
          </div>
        )}

        <button
          className={style.resendBtn}
          onClick={() => navigate(errorMessage ? "/auth" : "/profile")}
          disabled={!errorMessage && !sessionReady}
        >
          {sessionReady
            ? <><span>Complete Profile</span> <span className={style.arrow}>→</span></>
            : errorMessage
              ? "Go back to Login"
              : "Setting up session..."}
        </button>
      </div>
    </div>
  );
}

export default ConfirmEmail;

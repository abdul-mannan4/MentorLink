import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import style from "./ResetPassword.module.css";
import { Eye, EyeOff } from "lucide-react";

function ResetPassword() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tokenHash = queryParams.get("token_hash");
    const error = queryParams.get("error");

    if (error) {
      setErrorMessage("The reset link has expired or is invalid. Please request a new one.");
      return;
    }

    if (tokenHash) {
      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
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
      // Check if session is already active (implicit redirect/session from link)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          setErrorMessage("No active session found. Please click the reset link in your email.");
        }
      });
    }
  }, []);

  async function handlePasswordUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setResetSuccess(true);
    setLoading(false);
  }

  return (
    <div className={style.resetContainer}>
      <div className={style.resetCard}>
        <h2 className={style.brand}>MentorLink</h2>
        
        {errorMessage && (
          <div className={style.errorWrapper}>
            <h3>Error</h3>
            <p className={style.message}>{errorMessage}</p>
            <button className={style.actionBtn} onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        )}

        {!errorMessage && !sessionReady && (
          <div className={style.loadingWrapper}>
            <span className={style.spinnner}></span>
            <p className={style.message}>Verifying reset link, please wait...</p>
          </div>
        )}

        {!errorMessage && sessionReady && !resetSuccess && (
          <>
            <h3>Setup New Password</h3>
            <p className={style.message}>Please enter your new password below.</p>
            
            <form onSubmit={handlePasswordUpdate} className={style.form}>
              <div className={style.inputGroup}>
                <label className={style.label}>New Password</label>
                <div className={style.passwordWrapper}>
                  <input
                    className={`${style.input} ${style.passwordInput}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    className={style.togglePassword}
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={style.inputGroup}>
                <label className={style.label}>Confirm New Password</label>
                <input
                  className={style.input}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                className={style.actionBtn}
                type="submit"
                disabled={loading}
              >
                {loading ? <span className={style.spinner}></span> : "Update Password"}
              </button>
            </form>
          </>
        )}

        {resetSuccess && (
          <div className={style.successWrapper}>
            <svg className={style.circleSvg} viewBox="0 0 52 52">
              <circle className={style.circle} cx="26" cy="26" r="22" />
              <path className={style.check} d="M14 27 l8 8 l16 -16" />
            </svg>
            <h3>Password Updated!</h3>
            <p className={style.message}>
              Your password has been changed successfully. You can now access your dashboard.
            </p>
            <button className={style.actionBtn} onClick={() => navigate("/student")}>
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;

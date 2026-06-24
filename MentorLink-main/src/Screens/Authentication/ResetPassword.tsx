import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";
import style from "./ResetPassword.module.css";
import logoIcon from "../../assets/logo.png";
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

  // Fallback states for manual OTP entry if the magic link expired/got pre-fetched
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [emailInput, setEmailInput] = useState(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const emailParam = queryParams.get("email");
    if (emailParam) return decodeURIComponent(emailParam);

    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    const emailHashParam = hashParams.get("email");
    if (emailHashParam) return decodeURIComponent(emailHashParam);

    return localStorage.getItem("reset-email-input") || "";
  });
  const [tokenInput, setTokenInput] = useState("");
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tokenHash = queryParams.get("token_hash");
    const error = queryParams.get("error");
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));

    const emailParam = queryParams.get("email") || hashParams.get("email");
    if (emailParam) {
      setEmailInput(decodeURIComponent(emailParam));
    }

    const errorCode = queryParams.get("error_code") || hashParams.get("error_code");
    const errorDesc = queryParams.get("error_description") || hashParams.get("error_description") || queryParams.get("error_description");

    if (error || errorCode === "otp_expired" || errorDesc?.toLowerCase().includes("expired") || errorDesc?.toLowerCase().includes("invalid")) {
      // Magic link expired or invalid (e.g. pre-fetched by Outlook). Show the manual fallback OTP verification!
      setShowOtpVerify(true);
      return;
    }

    // Explicitly check for PKCE code in query parameters
    const code = queryParams.get("code");
    if (code) {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      fetch(`${API_URL}/auth/exchange-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
      })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && json.data?.session) {
          const session = json.data.session;
          localStorage.setItem("sb-session", JSON.stringify(session));
          localStorage.setItem("sb-user", JSON.stringify(session.user));
          
          window.dispatchEvent(new Event("storage"));
          
          setSessionReady(true);
          setErrorMessage("");
        } else {
          // If code exchange fails, fall back to manual OTP verification
          setShowOtpVerify(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        setErrorMessage("Network error exchanging code: " + err.message);
        setLoading(false);
      });
      return;
    }

    // Explicitly parse hash fragment (common in implicit grant redirects from Supabase)
    if (hash && hash.includes("access_token=")) {
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const expiresIn = hashParams.get("expires_in");
      const type = hashParams.get("type");

      if (accessToken && (type === "recovery" || hash.includes("type=recovery"))) {
        setLoading(true);
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        fetch(`${API_URL}/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        .then(async (res) => {
          const json = await res.json();
          if (res.ok && json.user) {
            const expiresAt = Math.floor(Date.now() / 1000) + parseInt(expiresIn || "3600");
            const session = {
              access_token: accessToken,
              refresh_token: refreshToken || "",
              expires_in: parseInt(expiresIn || "3600"),
              expires_at: expiresAt,
              token_type: "bearer",
              user: json.user
            };
            localStorage.setItem("sb-session", JSON.stringify(session));
            localStorage.setItem("sb-user", JSON.stringify(json.user));
            
            // Dispatch custom event to notify any active auth listeners
            window.dispatchEvent(new Event("storage"));
            
            setSessionReady(true);
            setErrorMessage("");
          } else {
            setShowOtpVerify(true);
          }
          setLoading(false);
        })
        .catch((err) => {
          setErrorMessage("Network error verifying your session: " + err.message);
          setLoading(false);
        });
        return;
      }
    }

    if (tokenHash) {
      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })
        .then(({ data, error }) => {
          if (error) {
            setShowOtpVerify(true);
            return;
          }
          if (data.session) {
            setSessionReady(true);
          }
        });
    } else {
      let timer: NodeJS.Timeout | undefined;
      // Check if session is already active (implicit redirect/session from link)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          // Don't show error immediately, wait a moment for onAuthStateChange to fire if parsing hash
          timer = setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
              if (!currentSession) {
                setShowOtpVerify(true);
              }
            });
          }, 3000); // 3 seconds timeout to give redirect processing ample time
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session) {
          setSessionReady(true);
          setShowOtpVerify(false);
          setErrorMessage(""); // Clear error if session becomes ready
        }
      });

      return () => {
        if (timer) clearTimeout(timer);
        subscription.unsubscribe();
      };
    }
  }, []);

  async function handleOtpVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError("");
    setLoading(true);

    const trimmedToken = tokenInput.trim();
    const trimmedEmail = emailInput.trim();

    if (!trimmedToken) {
      setOtpError("Verification code or token is required.");
      setLoading(false);
      return;
    }

    let session: any = null;
    let errorMsg = "";

    // 1. If it looks like a long token hash or code (more than 10 characters)
    if (trimmedToken.length > 10) {
      // First try to exchange it as a PKCE code
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const res = await fetch(`${API_URL}/auth/exchange-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ code: trimmedToken })
        });
        const json = await res.json();
        if (res.ok && json.data?.session) {
          session = json.data.session;
        }
      } catch (err) {
        console.log("PKCE code exchange check failed, will try token_hash next:", err);
      }

      // If PKCE exchange didn't yield a session, try verifying as a token_hash
      if (!session) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: trimmedToken,
          type: "recovery",
        });
        if (data?.session) {
          session = data.session;
        } else if (error) {
          errorMsg = error.message;
        }
      }
    } else {
      // 2. Otherwise, treat it as a standard 6-digit numeric OTP code
      if (!trimmedEmail) {
        setOtpError("Email is required for 6-digit code verification.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "recovery",
      });
      if (data?.session) {
        session = data.session;
      } else if (error) {
        errorMsg = error.message;
      }
    }

    if (session) {
      localStorage.setItem("sb-session", JSON.stringify(session));
      localStorage.setItem("sb-user", JSON.stringify(session.user));
      window.dispatchEvent(new Event("storage"));
      
      setSessionReady(true);
      setShowOtpVerify(false);
      setOtpError("");
    } else {
      setOtpError(errorMsg || "Failed to authenticate verification session. Please try requesting a new link.");
    }
    setLoading(false);
  }

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
        <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
        <h2 className={style.brand}>NTUConnect</h2>
        
        {errorMessage && !showOtpVerify && (
          <div className={style.errorWrapper}>
            <h3>Error</h3>
            <p className={style.message}>{errorMessage}</p>
            <button className={style.actionBtn} onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        )}

        {!errorMessage && !sessionReady && !showOtpVerify && (
          <div className={style.loadingWrapper}>
            <span className={style.spinnner}></span>
            <p className={style.message}>Verifying reset link, please wait...</p>
          </div>
        )}

        {showOtpVerify && !sessionReady && !resetSuccess && (
          <>
            <h3>Verify Reset Code</h3>
            <p className={style.message}>
              Outlook's link scanner may have consumed your link. Please enter your email and the verification code from the email.
            </p>
            
            {otpError && (
              <p 
                className={style.errorText} 
                style={{ color: "#dc2626", fontWeight: 500, fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}
              >
                {otpError}
              </p>
            )}
 
            <form onSubmit={handleOtpVerify} className={style.form}>
              <div className={style.inputGroup}>
                <label className={style.label}>Student Email</label>
                <input
                  className={style.input}
                  type="email"
                  placeholder="23ntucsfl1003@student.ntu.edu.pk"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              </div>
 
              <div className={style.inputGroup}>
                <label className={style.label}>Verification Code</label>
                <input
                  className={style.input}
                  type="text"
                  placeholder="Enter code"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  maxLength={256}
                  required
                />
              </div>

              <button
                className={style.actionBtn}
                type="submit"
                disabled={loading}
              >
                {loading ? <span className={style.spinner}></span> : "Verify Code"}
              </button>
            </form>
          </>
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

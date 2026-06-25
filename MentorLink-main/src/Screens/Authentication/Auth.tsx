// Auth.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

import type { ChangeEvent } from "react";
import style from "./Auth.module.css";
import logoIcon from "../../assets/logo.svg";
import { Eye, EyeOff, X } from "lucide-react";

type Props = {
  onClose: () => void;
};

function Auth({ onClose }: Props) {
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>((""));
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [forgotSuccess, setForgotSuccess] = useState<boolean>(false);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const navigate = useNavigate();

  function isValidStudentEmail(email: string) {
    const regex = /^(2[0-9])ntu(cs|ct)fl\d{4}@student\.ntu\.edu\.pk$/;

    return regex.test(email);
  }

  async function handleForgotSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (!email) {
      setErrorMessage("Email is required.");
      setLoading(false);
      return;
    }

    if (!isValidStudentEmail(email)) {
      setErrorMessage(
        "Invalid email format. Use a valid NTU CS or CT email address."
      );
      setLoading(false);
      return;
    }

    // Save to local storage for automatic prefill on the same device
    localStorage.setItem("reset-email-input", email);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setForgotSuccess(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (isSignUp) {
      if (!isValidStudentEmail(email)) {
        setErrorMessage(
          "Invalid email format. Use a valid NTU CS or CT email address."
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/email-verified`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      navigate("/email-sent", { state: { email } });
      setEmail("");
      setPassword("");
      setLoading(false);
      return;
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }
      navigate("/student", { replace: true });
      setLoading(false);
    }
  }

  return (
    <div className={style.overlay}>
      <div className={style.loginCard}>
        <div className={style.closeBtn}>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {view === "forgot" ? (
          <>
            <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
            <h2 className={style.title}>Reset Password</h2>
            {!forgotSuccess ? (
              <>
                <p className={style.subtitle}>
                  Enter your student email and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleForgotSubmit} className={style.form}>
                  <div className={style.inputGroup}>
                    <label className={style.label}>Student Email</label>
                    <input
                      className={style.input}
                      type="email"
                      placeholder="23ntucsfl1003@student.ntu.edu.pk"
                      value={email}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setEmail(e.target.value)
                      }
                      autoComplete="email"
                      required
                    />
                    {errorMessage && <p className={style.error}>{errorMessage}</p>}
                  </div>

                  <button
                    className={style.submitBtn}
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className={style.spinner}></span>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>

                  <button
                    type="button"
                    className={style.backToLoginBtn}
                    onClick={() => {
                      setView("auth");
                      setErrorMessage("");
                    }}
                  >
                    Back to Sign In
                  </button>
                </form>
              </>
            ) : (
              <div className={style.successState}>
                <div className={style.successIconWrapper}>
                  <svg className={style.circleSvg} viewBox="0 0 52 52" style={{ width: 64, height: 64, margin: "1.5rem auto" }}>
                    <circle className={style.circle} cx="26" cy="26" r="22" stroke="#22c55e" strokeWidth="3" fill="none" />
                    <path className={style.check} d="M14 27 l8 8 l16 -16" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "1rem 0" }}>Check Your Inbox</h3>
                <p className={style.subtitle}>
                  We've sent a password reset code to <strong>{email}</strong>. Please check your inbox (including Junk folder) for the code.
                </p>

                <button
                  type="button"
                  className={style.submitBtn}
                  style={{ marginBottom: "0.5rem" }}
                  onClick={() => {
                    onClose();
                    navigate("/reset-password");
                  }}
                >
                  Enter Code Manually
                </button>

                <button
                  type="button"
                  className={style.backToLoginBtn}
                  style={{ width: "100%", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.875rem", marginTop: "0.5rem" }}
                  onClick={() => {
                    setView("auth");
                    setForgotSuccess(false);
                    setEmail("");
                    setErrorMessage("");
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
            <h2 className={style.title}>NTUConnect</h2>
            <p className={style.subtitle}>
              {isSignUp
                ? "Create your student account to connect with mentors."
                : "Sign in to your student account to connect with mentors."}
            </p>

            {/* Tab Switcher */}
            <div className={style.tabContainer}>
              <button
                type="button"
                className={`${style.tab} ${!isSignUp ? style.activeTab : style.inactiveTab}`}
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMessage("");
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`${style.tab} ${isSignUp ? style.activeTab : style.inactiveTab}`}
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage("");
                }}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className={style.form}>
              <div className={style.inputGroup}>
                <label className={style.label}>Student Email</label>
                <input
                  className={style.input}
                  type="email"
                  placeholder="23ntucsfl1003@student.ntu.edu.pk"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </div>

              <div className={style.inputGroup}>
                <label className={style.label}>Password</label>
                <div className={style.passwordWrapper}>
                  <input
                    className={`${style.input} ${style.passwordInput}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••••••••••••••"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    className={style.togglePassword}
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errorMessage && <p className={style.error}>{errorMessage}</p>}
                {!isSignUp && (
                  <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className={style.forgotLink}
                      onClick={() => {
                        setView("forgot");
                        setErrorMessage("");
                        setForgotSuccess(false);
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              <button
                className={style.submitBtn}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className={style.spinner}></span>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>

              <div className={style.footer}>
                <span>
                  {isSignUp ? "Already have an account?" : "Don't have an account?"}
                </span>
                <button
                  type="button"
                  className={style.footerBtn}
                  onClick={() => {
                    setIsSignUp((p) => !p);
                    setErrorMessage("");
                  }}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Auth;
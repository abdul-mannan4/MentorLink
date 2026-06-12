// Auth.tsx — Redesigned from scratch
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase as proxySupabase } from "../../supabase-client";
import type { ChangeEvent } from "react";
import style from "./Auth.module.css";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  onClose: () => void;
};

type Mode = "signin" | "signup";

function Auth({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const EMAIL_PATTERN = /^[0-9]{2}ntucsfl\d{4}@student\.ntu\.edu\.pk$/;
  const EXAMPLE_EMAIL = "20ntucsfl1000@student.ntu.edu.pk";

  function isValidStudentEmail(value: string) {
    return EMAIL_PATTERN.test(value);
  }

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setEmail(value);
    if (value && !isValidStudentEmail(value)) {
      setEmailError(`Format: ${EXAMPLE_EMAIL}`);
    } else {
      setEmailError("");
    }
    setErrorMessage("");
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPassword(value);
    if (mode === "signup" && value && value.length < 8) {
      setPasswordError("Password must be at least 8 characters");
    } else {
      setPasswordError("");
    }
    setErrorMessage("");
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setEmail("");
    setPassword("");
    setEmailError("");
    setPasswordError("");
    setErrorMessage("");
  }

  // Initialize a direct, native Supabase client for Authentication
  // This bypasses the Railway proxy entirely, preventing all the 400 errors and false positives
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const nativeSupabase = createClient(supabaseUrl, supabaseKey);

  async function handleSignUp() {
    // 1. Direct call to Supabase to create the account
    const { data, error } = await nativeSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-verified`,
      },
    });

    // 2. Handle actual errors (like SMTP failures)
    if (error) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes("already registered") || msg.includes("already exist") || msg.includes("already in use")) {
        setErrorMessage("⚠️ An account with this email already exists. Please sign in instead.");
        setMode("signin");
        setPassword("");
        return;
      }
      
      if (msg.includes("rate limit") || msg.includes("sending confirmation")) {
        setErrorMessage("❌ Email sending failed. Please wait a minute and try again.");
        return;
      }

      setErrorMessage(error.message);
      return;
    }

    // 3. Supabase Quirk: If the user ALREADY EXISTS, it returns data but with empty identities array!
    // This is the most reliable way to detect duplicate accounts in Supabase.
    if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      setErrorMessage("⚠️ An account with this email already exists. Please sign in instead.");
      setMode("signin");
      setPassword("");
      return;
    }

    // 4. Success! A real account was created. Navigate to email-sent page.
    navigate("/email-sent", { state: { email } });
  }

  async function handleSignIn() {
    // We use the proxy for sign in so the session is stored in localStorage correctly
    // for the rest of the app to use
    const { error } = await proxySupabase.auth.signInWithPassword({ email, password });


    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setErrorMessage(
          "📧 Your email is not verified yet. Please check your inbox."
        );
      } else if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
        setErrorMessage("❌ Incorrect email or password. Please try again.");
      } else {
        setErrorMessage(error.message);
      }
      return;
    }

    navigate("/student", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (!email || !isValidStudentEmail(email)) {
      setErrorMessage(`Invalid email format. Use: ${EXAMPLE_EMAIL}`);
      setLoading(false);
      return;
    }

    if (!password || (mode === "signup" && password.length < 8)) {
      setErrorMessage(
        mode === "signup"
          ? "Password must be at least 8 characters"
          : "Please enter your password"
      );
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        await handleSignUp();
      } else {
        await handleSignIn();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={style.loginContainer}>
        <div className={style.loginCard}>
          <div className={style.closeBtn}>
            <button onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className={style.authHeader}>
            <h2>MentorLink</h2>
            <p className={style.authSubtitle}>
              {mode === "signup"
                ? "Create your student account to connect with mentors."
                : "Sign in with your NTU student email to continue."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className={style.modeTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={`${style.modeTab} ${mode === "signin" ? style.activeTab : ""}`}
              onClick={() => switchMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`${style.modeTab} ${mode === "signup" ? style.activeTab : ""}`}
              onClick={() => switchMode("signup")}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={style.inputForm}>
              {/* Email field */}
              <label className={style.inputLabel} htmlFor="auth-email">
                Student Email
              </label>
              <input
                id="auth-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder={`e.g. ${EXAMPLE_EMAIL}`}
                value={email}
                onChange={handleEmailChange}
                disabled={loading}
              />
              {emailError && <p className={style.fieldError}>{emailError}</p>}

              {/* Password field */}
              <label className={style.inputLabel} htmlFor="auth-password">
                Password
              </label>
              <div className={style.passwordWrapper}>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder={
                    mode === "signup"
                      ? "Create a password (min. 8 chars)"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className={style.fieldError}>{passwordError}</p>
              )}

              {/* Global error message */}
              {errorMessage && (
                <div className={style.errorBanner} role="alert">
                  {errorMessage}
                </div>
              )}

              <button
                id={mode === "signup" ? "btn-create-account" : "btn-sign-in"}
                className={loading ? style.disabledButton : style.primaryButton}
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                  ? "Create Account"
                  : "Sign In"}
              </button>
            </div>

            <div className={style.footer}>
              <small>
                {mode === "signup"
                  ? "Already have an account?"
                  : "Don't have an account?"}
              </small>
              <button
                type="button"
                className={style.secondaryButton}
                onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default Auth;

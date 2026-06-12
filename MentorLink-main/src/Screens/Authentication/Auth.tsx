// Auth.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

import type { ChangeEvent } from "react";
import style from "./Auth.module.css";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  onClose: () => void;
};

function Auth({ onClose }: Props) {
  const [isSignUp, setIsSignUp] = useState(false);
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

  function isValidStudentEmail(email: string) {
    return EMAIL_PATTERN.test(email);
  }

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setEmail(value);
    
    // Real-time validation feedback
    if (value && !isValidStudentEmail(value)) {
      setEmailError(`Email should match pattern: ${EXAMPLE_EMAIL}`);
    } else {
      setEmailError("");
    }
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPassword(value);
    
    // Real-time validation feedback for sign-up only
    if (isSignUp && value && value.length < 8) {
      setPasswordError("Password must be at least 8 characters");
    } else {
      setPasswordError("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    // Validate email for both sign-up and sign-in
    if (!email || !isValidStudentEmail(email)) {
      setErrorMessage(
        `Invalid email format. Please use: ${EXAMPLE_EMAIL}`
      );
      setLoading(false);
      return;
    }

    // Validate password for sign-up
    if (isSignUp && (!password || password.length < 8)) {
      setErrorMessage("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/email-verified`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exist")) {
          setIsSignUp(false); // Automatically switch to Sign In mode
        }
        return;
      }

      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setErrorMessage("Email already registered. Please sign in.");
        setIsSignUp(false); // Automatically switch to Sign In mode
        setLoading(false);
        return;
      }

      navigate("/email-sent", {
        state: { email },
      });

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
    <>
      <div className={style.loginContainer}>
        <div className={`${style.loginCard}`}>
          <div className={style.closeBtn}>
            <button onClick={onClose}>X</button>
          </div>

          <div className={style.authHeader}>
            <h2>MentorLink</h2>
            <p className={style.authSubtitle}>
              {isSignUp
                ? "Create your student account to connect with mentors."
                : "Sign in with your NTU student email to continue."}
            </p>
          </div>

          <div className={style.modeTabs}>
            <button
              type="button"
              className={`${style.modeTab} ${!isSignUp ? style.activeTab : ""}`}
              onClick={() => setIsSignUp(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`${style.modeTab} ${isSignUp ? style.activeTab : ""}`}
              onClick={() => setIsSignUp(true)}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={style.inputForm}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={`e.g. ${EXAMPLE_EMAIL}`}
                value={email}
                onChange={handleEmailChange}
              />
              {emailError && <p className={style.error}>{emailError}</p>}

              <div className={style.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={handlePasswordChange}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              {passwordError && <p className={style.error}>{passwordError}</p>}

              {errorMessage && <p className={style.error}>{errorMessage}</p>}

              <button
                className={loading ? style.disabledButton : style.primaryButton}
                type="submit"
                disabled={loading}
              >
                {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
              </button>
            </div>

            <div className={style.footer}>
              <small>
                {isSignUp
                  ? "Already have an account?"
                  : "Don't have an account?"}
              </small>

              <button
                type="button"
                className={style.secondaryButton}
                onClick={() => setIsSignUp((p) => !p)}
              >
                {isSignUp ? "Switch to Sign In" : "Switch to Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default Auth;

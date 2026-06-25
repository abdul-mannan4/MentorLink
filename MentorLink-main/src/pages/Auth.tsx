// Auth.tsx (version 2 - simple)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase-client";

import type { ChangeEvent } from "react";
import style from "./Auth.module.css";
import logoIcon from "../assets/logo.svg";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  onClose: () => void;
};

function Auth({ onClose }: Props) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function isValidStudentEmail(email: string) {
    // Accepts: 23ntucsfl1003 or 23ntuctfl1003 (cs or ct, then fl, then exactly 4 digits)
    const regex = /^(2[0-9])ntu(cs|ct)fl\d{4}@student\.ntu\.edu\.pk$/i;
    return regex.test(email.trim());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const cleanEmail = email.replace(/\s/g, "");

    if (!isValidStudentEmail(cleanEmail)) {
      setErrorMessage(
        "Invalid email format. Use: 23ntucsfl1003@student.ntu.edu.pk"
      );
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
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

      if (
        data.user &&
        data.user.identities &&
        data.user.identities.length === 0
      ) {
        setErrorMessage("Email already registered. Please sign in instead.");
        setLoading(false);
        return;
      }

      navigate("/email-sent", { state: { email: cleanEmail } });
      setEmail("");
      setPassword("");
      setLoading(false);
      return;
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      navigate("/dashboard");
      setLoading(false);
    }
  }

  return (
    <div className={style.loginContainer}>
      <div className={style.loginCard}>
        <div className={style.closeBtn}>
          <button onClick={onClose}>X</button>
        </div>

        <img src={logoIcon} className={style.logoImg} alt="NTUConnect Logo" />
        <h2>NTUConnect</h2>

        <form onSubmit={handleSubmit}>
          <div className={style.inputForm}>
            <input
              type="email"
              placeholder="e.g. 23ntu(cs|ct)fl1002@student.ntu.edu.pk"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
            />

            <div className={style.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
              />

              <button type="button" onClick={() => setShowPassword((p) => !p)}>
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            {errorMessage && <p className={style.error}>{errorMessage}</p>}

            <button
              className={style.signInButton}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner"></span>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </button>
          </div>

          <div className={style.footer}>
            <small>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </small>

            <button
              type="button"
              className={style.signInButton}
              onClick={() => setIsSignUp((p) => !p)}
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Auth;
// Auth.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase-client";

import type { ChangeEvent } from "react";
import style from "./Auth.module.css";
import { Eye, EyeOff } from "lucide-react";



type Props={
  onClose:()=>void
}


function Auth({onClose}:Props) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
 
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate=useNavigate();
    

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (isSignUp) {
      const { data,error } = await supabase.auth.signUp({
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

      if(data?.user?.identities?.length===0)
      {
        setErrorMessage("Email already registered.Please sign in.");
        setLoading(false);
        return;
      }

      navigate("/email-sent",{
        state:{email}
      })


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
        navigate("/dashboard")
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
            <h2>MentorLink</h2>

            <form onSubmit={handleSubmit}>
              <div className={style.inputForm}>
                <input
                  type="email"
                  placeholder="e.g. 23ntucsfl1000@student.edu.pk"
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

                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                {errorMessage && (
                  <p className={style.error}>{errorMessage}</p>
                )}

                <button
                  className={loading  ? "spinner" : style.signInButton}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinnner"></span>
                  ) : isSignUp ? (
                    "Sign Up"
                  ) : (
                    "Sign In"
                  )}
                </button>
              </div>

              <div className={style.footer}>
                <small>
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </small>

                <button type="button" className={style.signInButton} onClick={() => setIsSignUp((p) => !p)}>
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
    
    </>
  );
}

export default Auth;
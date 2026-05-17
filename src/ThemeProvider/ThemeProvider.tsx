import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: Props) => {
  const [isDark, setIsDark] = useState(false);

  // useEffect(() => {
  //   document.documentElement.setAttribute("data-theme", "dark");
  // }, []);
  // apply theme globally
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// custom hook (safe usage)
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};

import React from "react";
import { useTheme } from "../../ThemeProvider/ThemeProvider";
import styles from "../ModeButton/ModeButton.module.css";
const ModeButton = () => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <div>
      <button
        className={styles.Mode}
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
      >
        <span
          className={`${styles.modeButton} ${
            isDark ? styles.modeButtonDark : ""
          }`}
        >
          {isDark ? "🌤️" : "🌙"}
        </span>
      </button>
    </div>
  );
};

export default ModeButton;

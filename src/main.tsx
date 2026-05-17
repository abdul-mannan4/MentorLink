
import { createRoot } from "react-dom/client";
import "./Styles/theme/theme.css";
import "./index.css";
import { ThemeProvider } from "./ThemeProvider/ThemeProvider.tsx";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  
    <ThemeProvider>
      <App />
    </ThemeProvider>

);

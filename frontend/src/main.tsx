import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/index.css";
import App from "./app/App";
import { initTheme } from "./utils/theme";
import { AuthProvider } from "./providers/AuthProvider";
import SessionWarning from "./components/ui/CountdownToast";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
        <SessionWarning />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);

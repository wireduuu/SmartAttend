import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/index.css";
import App from "./app/App";
import { initTheme } from "./utils/theme";
import { AuthProvider } from "./providers/AuthProvider";
import CountdownToast from "./components/ui/CountdownToast";
import { Toaster } from "sonner";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
        <CountdownToast />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);

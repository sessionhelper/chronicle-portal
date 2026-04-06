import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/layout/app-shell";
import { Dashboard } from "./pages/dashboard";
import { Sessions } from "./pages/sessions";
import { SessionDetail } from "./pages/session-detail";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  </StrictMode>,
);

import { useState } from "react";
import "./App.scss";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// Auth pages
import Login from "../features/auth/components/Login";
import Register from "../features/auth/components/Register";
import VerifyOTP from "../features/auth/components/VerifyOTP";
import ForgotPassword from "../features/auth/components/ForgotPassword";
import ResetPassword from "../features/auth/components/ResetPassword";
import SetPassword from "../features/auth/components/SetPassword";

// Route guards
import ProtectedRoute from "../components/common/ProtectedRoute";
import PublicRoute from "../components/common/PublicRoute";

// App pages
import Landing from "../features/landing/components/Landing";
import Dashboard from "../features/dashboard/components/Dashboard";
import Config from "../features/config/components/Config";
import Analysis from "../features/analysis/components/Analysis";
import Roadmap from "../features/roadmap/components/Roadmap";
import Compliance from "../features/compliance/components/Compliance";
import Audits from "../features/audits/components/Audits";
import Profile from "../features/profile/components/Profile";
import WelcomeAnimation from "../components/common/WelcomeAnimation/WelcomeAnimation";
import GlobalAssistantOverlay from "../features/aiAssistant/components/GlobalAssistantOverlay";

function App() {
  const [animDone, setAnimDone] = useState(() => {
    return sessionStorage.getItem('welcomeAnimDone') === 'true' || localStorage.getItem('hasLoggedIn') === 'true';
  });

  const handleAnimComplete = () => {
    setAnimDone(true);
    sessionStorage.setItem('welcomeAnimDone', 'true');
  };

  return (
    <div className="App">
      {!animDone && <WelcomeAnimation onComplete={handleAnimComplete} />}
      <div style={{ opacity: animDone ? 1 : 0, transition: "opacity 0.5s ease-in", pointerEvents: animDone ? "auto" : "none" }}>
        <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────────────────── */}
          <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/verify-otp" element={<PublicRoute><VerifyOTP /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          <Route path="/set-password" element={<PublicRoute><SetPassword /></PublicRoute>} />

          {/* ── Protected ───────────────────────────────────── */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/config" element={<ProtectedRoute><Config /></ProtectedRoute>} />
          <Route path="/audits" element={<ProtectedRoute><Audits /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalAssistantOverlay />
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
      </div>
    </div>
  );
}

export default App;

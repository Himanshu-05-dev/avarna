/**
 * LEVEL 1 — UI
 * SetPassword — for Google OAuth users who have no password yet.
 * Called after Google callback redirects to /register with a cookie set.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import AvaranaLogo from "../../../components/common/AvaranaLogo/AvaranaLogo";
import { useSetPassword } from "../hooks/useAuth";
import "./auth.styles.css";

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
const STRENGTH_LABELS = ["Weak", "Fair", "Good", "Strong"];

export default function SetPassword() {
  const { setPassword, loading, error } = useSetPassword();

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPass: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState("");

  const strength = getStrength(form.password);

  const handleChange = (e) => {
    setLocalError("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPass) {
      setLocalError("Passwords do not match.");
      return;
    }
    setPassword(form);
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb--1" />
      <div className="auth-bg-orb auth-bg-orb--2" />

      <div className="auth-card">
        <Link to="/login" className="auth-back">
          <ArrowLeft size={14} /> Back to login
        </Link>

        <div className="auth-brand">
          <AvaranaLogo size={52} showName={true} showSub={true} inline={false} />
        </div>

        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              background: "rgba(212,175,122,0.1)",
              border: "1px solid rgba(212,175,122,0.2)",
              borderRadius: "50%",
            }}
          >
            <Lock size={26} color="#D4AF7A" />
          </div>
        </div>

        <h1 className="auth-heading" style={{ textAlign: "center" }}>
          Create your password
        </h1>

        <div className="auth-info">
          You signed in with <strong>Google</strong>. Set a password so you can
          also sign in with your email in the future.
        </div>

        {displayError && <div className="auth-error">{displayError}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="auth-field">
            <label htmlFor="setp-email" className="auth-label">Your email</label>
            <input
              id="setp-email"
              type="email"
              name="email"
              className="auth-input"
              placeholder="you@domain.com"
              value={form.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          {/* New Password */}
          <div className="auth-field">
            <label htmlFor="setp-password" className="auth-label">New password</label>
            <div className="auth-input-wrapper">
              <input
                id="setp-password"
                type={showPass ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                className="auth-input auth-input--padded-right"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Hide" : "Show"}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <>
                <div className="auth-strength">
                  <div
                    className="auth-strength__bar"
                    style={{
                      width: `${(strength / 4) * 100}%`,
                      background: STRENGTH_COLORS[strength - 1] || "#ef4444",
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.72rem", color: STRENGTH_COLORS[strength - 1] || "#ef4444", marginTop: "0.2rem" }}>
                  {STRENGTH_LABELS[strength - 1] || "Too short"}
                </span>
              </>
            )}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label htmlFor="setp-confirm" className="auth-label">Confirm password</label>
            <div className="auth-input-wrapper">
              <input
                id="setp-confirm"
                type={showConfirm ? "text" : "password"}
                name="confirmPass"
                autoComplete="new-password"
                className="auth-input auth-input--padded-right"
                placeholder="Repeat password"
                value={form.confirmPass}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide" : "Show"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="set-password-btn"
            type="submit"
            className="auth-btn auth-btn--primary"
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="auth-spinner" />
            ) : (
              <>
                <Lock size={18} />
                Save Password
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Skip for now?{" "}
          <Link to="/dashboard" className="auth-link">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
}

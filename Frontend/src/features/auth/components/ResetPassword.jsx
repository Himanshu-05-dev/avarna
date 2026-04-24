/**
 * LEVEL 1 — UI
 * ResetPassword — OTP + new password + confirm.
 * Pre-fills email & OTP from query params (sent by backend email link).
 */
import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import AvaranaLogo from "../../../components/common/AvaranaLogo/AvaranaLogo";
import { useResetPassword } from "../hooks/useAuth";
import "./auth.styles.css";

/** Strength: 0–4 */
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

export default function ResetPassword() {
  const { resetPassword, loading, error } = useResetPassword();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    email: searchParams.get("email") || "",
    otp: searchParams.get("otp") || "",
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
    resetPassword(form);
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb--1" />
      <div className="auth-bg-orb auth-bg-orb--2" />

      <div className="auth-card">
        <Link to="/forgot-password" className="auth-back">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="auth-brand">
          <AvaranaLogo size={52} showName={true} showSub={true} inline={false} />
        </div>

        <h1 className="auth-heading">Reset password</h1>
        <p className="auth-sub">
          Enter the code from your email and choose a new password.
        </p>

        {displayError && <div className="auth-error">{displayError}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email (prefilled, editable) */}
          <div className="auth-field">
            <label htmlFor="reset-email" className="auth-label">Email</label>
            <input
              id="reset-email"
              type="email"
              name="email"
              className="auth-input"
              placeholder="you@domain.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* OTP (prefilled if clicked from email link) */}
          <div className="auth-field">
            <label htmlFor="reset-otp" className="auth-label">Reset Code (6 digits)</label>
            <input
              id="reset-otp"
              type="text"
              name="otp"
              inputMode="numeric"
              maxLength={6}
              className="auth-input"
              placeholder="123456"
              value={form.otp}
              onChange={handleChange}
              required
            />
          </div>

          {/* New Password */}
          <div className="auth-field">
            <label htmlFor="reset-password" className="auth-label">New password</label>
            <div className="auth-input-wrapper">
              <input
                id="reset-password"
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
            {/* Strength bar */}
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
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: STRENGTH_COLORS[strength - 1] || "#ef4444",
                    marginTop: "0.2rem",
                  }}
                >
                  {STRENGTH_LABELS[strength - 1] || "Too short"}
                </span>
              </>
            )}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label htmlFor="reset-confirm" className="auth-label">Confirm password</label>
            <div className="auth-input-wrapper">
              <input
                id="reset-confirm"
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
            id="reset-password-btn"
            type="submit"
            className="auth-btn auth-btn--primary"
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="auth-spinner" />
            ) : (
              <>
                <ShieldCheck size={18} />
                Reset Password
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Back to{" "}
          <Link to="/login" className="auth-link">Login</Link>
        </p>
      </div>
    </div>
  );
}

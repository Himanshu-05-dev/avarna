/**
 * LEVEL 1 — UI
 * Login page — jigyaza.ai-style split layout, light theme.
 * Left: animated dashboard mockup + headline. Right: minimal form.
 */
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useLogin, useGetMe } from "../hooks/useAuth";
import { GOOGLE_AUTH_URL } from "../api/auth.api";
import "./auth.styles.css";

/* ── Dashboard mockup (pure CSS/JSX, no images needed) ────── */
function DashboardMockup() {
  return (
    <div className="auth-mockup">
      {/* Fake browser top bar */}
      <div className="auth-mockup__topbar">
        <div className="auth-mockup__dot" style={{ background: "#fca5a5" }} />
        <div className="auth-mockup__dot" style={{ background: "#fde68a" }} />
        <div className="auth-mockup__dot" style={{ background: "#bbf7d0" }} />
        <div className="auth-mockup__url" />
      </div>

      {/* Fake dashboard body */}
      <div className="auth-mockup__body">
        {/* Header row */}
        <div className="auth-mockup__header-row">
          <div className="auth-mockup__title" />
          <div className="auth-mockup__badge" />
        </div>

        {/* Stat cards row */}
        <div className="auth-mockup__stat-row">
          {[
            { val: "#dbeafe", w: "45px" },
            { val: "#dcfce7", w: "55px" },
            { val: "#fef9c3", w: "35px" },
          ].map((s, i) => (
            <div className="auth-mockup__stat" key={i}>
              <div
                className="auth-mockup__stat-val"
                style={{ background: s.val, width: s.w }}
              />
              <div className="auth-mockup__stat-label" />
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="auth-mockup__chart">
          {[30, 55, 40, 80, 60, 90, 50, 70].map((h, i) => (
            <div
              key={i}
              className={`auth-mockup__bar${i === 5 ? " auth-mockup__bar--active" : ""}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        {/* Audit rows */}
        {[
          { col: "#dbeafe", chip: "#bfdbfe" },
          { col: "#dcfce7", chip: "#bbf7d0" },
          { col: "#fecaca", chip: "#fca5a5" },
        ].map((r, i) => (
          <div className="auth-mockup__row" key={i}>
            <div
              className="auth-mockup__avatar"
              style={{ background: r.col }}
            />
            <div className="auth-mockup__row-label" />
            <div
              className="auth-mockup__row-chip"
              style={{ background: r.chip }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { login, loading, error } = useLogin();
  const { fetchMe, isAuthenticated } = useGetMe();
  const navigate = useNavigate();

  useEffect(() => { 
    fetchMe(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(form);
  };

  return (
    <div className="auth-page">
      {/* ══ LEFT — visual panel ══════════════════════════════ */}
      <div className="auth-panel-left">
        {/* Brand */}
        <div className="auth-panel-left__brand">
          <div className="auth-panel-left__logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
              <path
                d="M2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span className="auth-panel-left__logo-text">YourCrawl</span>
            <span className="auth-panel-left__logo-sub">by Avarana</span>
          </div>
        </div>

        {/* Dashboard mockup preview */}
        <div className="auth-panel-left__visual">
          <DashboardMockup />
        </div>

        {/* Bottom tagline */}
        <div className="auth-panel-left__bottom">
          <div className="auth-panel-left__tag">
            <span className="auth-panel-left__tag-dot" />
            Your compliance companion
          </div>
          <h2 className="auth-panel-left__headline">
            Detect dark patterns.<br />
            <em>Ship with confidence.</em>
          </h2>
          <p className="auth-panel-left__desc">
            AI-powered audit platform that identifies manipulative UI patterns
            and keeps your product legally compliant — in seconds.
          </p>
        </div>
      </div>

      {/* ══ RIGHT — form panel ═══════════════════════════════ */}
      <div className="auth-panel-right">
        <div className="auth-card">
          <h1 className="auth-heading">Good to see you.</h1>
          <p className="auth-sub">
            Please enter your details to sign in to your account.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                className="auth-input"
                placeholder="name@company.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="login-password" className="auth-label">
                  Password
                </label>
                <Link to="/forgot-password" className="auth-forgot">
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrapper">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  className="auth-input auth-input--padded-right"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} className="auth-spinner" />
              ) : (
                <>
                  Sign in to account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Google OAuth */}
          <a
            id="google-login-btn"
            href={GOOGLE_AUTH_URL}
            className="auth-btn auth-btn--google"
          >
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          {/* Footer */}
          <p className="auth-footer">
            New to YourCrawl?{" "}
            <Link to="/register" className="auth-link">
              Start your free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

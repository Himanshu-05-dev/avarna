/**
 * LEVEL 1 — UI
 * ForgotPassword — jigyaza.ai-style split layout, light theme.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { useForgotPassword } from "../hooks/useAuth";
import "./auth.styles.css";

function DashboardMockup() {
  return (
    <div className="auth-mockup">
      <div className="auth-mockup__topbar">
        <div className="auth-mockup__dot" style={{ background: "#fca5a5" }} />
        <div className="auth-mockup__dot" style={{ background: "#fde68a" }} />
        <div className="auth-mockup__dot" style={{ background: "#bbf7d0" }} />
        <div className="auth-mockup__url" />
      </div>
      <div className="auth-mockup__body">
        <div className="auth-mockup__header-row">
          <div className="auth-mockup__title" />
          <div className="auth-mockup__badge" />
        </div>
        <div className="auth-mockup__stat-row">
          {[{ val: "#dbeafe", w: "45px" }, { val: "#dcfce7", w: "55px" }, { val: "#fef9c3", w: "35px" }].map((s, i) => (
            <div className="auth-mockup__stat" key={i}>
              <div className="auth-mockup__stat-val" style={{ background: s.val, width: s.w }} />
              <div className="auth-mockup__stat-label" />
            </div>
          ))}
        </div>
        <div className="auth-mockup__chart">
          {[30, 55, 40, 80, 60, 90, 50, 70].map((h, i) => (
            <div key={i} className={`auth-mockup__bar${i === 5 ? " auth-mockup__bar--active" : ""}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        {[{ col: "#dbeafe", chip: "#bfdbfe" }, { col: "#dcfce7", chip: "#bbf7d0" }].map((r, i) => (
          <div className="auth-mockup__row" key={i}>
            <div className="auth-mockup__avatar" style={{ background: r.col }} />
            <div className="auth-mockup__row-label" />
            <div className="auth-mockup__row-chip" style={{ background: r.chip }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  const { forgotPassword, loading, error } = useForgotPassword();
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    forgotPassword(email);
  };

  return (
    <div className="auth-page">
      {/* ══ LEFT — visual panel ══════════════════════════════ */}
      <div className="auth-panel-left">
        <div className="auth-panel-left__brand">
          <div className="auth-panel-left__logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="auth-panel-left__logo-text">YourCrawl</span>
            <span className="auth-panel-left__logo-sub">by Avarana</span>
          </div>
        </div>

        <div className="auth-panel-left__visual">
          <DashboardMockup />
        </div>

        <div className="auth-panel-left__bottom">
          <div className="auth-panel-left__tag">
            <span className="auth-panel-left__tag-dot" />
            Secure account recovery
          </div>
          <h2 className="auth-panel-left__headline">
            Back in seconds.<br />
            <em>Safe and secure.</em>
          </h2>
          <p className="auth-panel-left__desc">
            We&apos;ll send a time-limited reset code to your email.
            Your data is always safe during recovery.
          </p>
        </div>
      </div>

      {/* ══ RIGHT — form panel ═══════════════════════════════ */}
      <div className="auth-panel-right">
        <div className="auth-card">
          <Link to="/login" className="auth-back">
            <ArrowLeft size={14} /> Back to login
          </Link>

          {/* Icon badge */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 50,
                height: 50,
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: "14px",
              }}
            >
              <KeyRound size={22} color="#2563eb" />
            </div>
          </div>

          <h1 className="auth-heading">Forgot password?</h1>
          <p className="auth-sub">
            Enter your email and we&apos;ll send you a reset code.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="forgot-email" className="auth-label">
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              id="forgot-submit-btn"
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} className="auth-spinner" />
              ) : (
                <>
                  Send reset code
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="auth-footer">
            Remembered it?{" "}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

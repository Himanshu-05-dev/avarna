/**
 * LEVEL 1 — UI
 * VerifyOTP — 6-box OTP entry after registration.
 * Auto-advances boxes, backspace works naturally.
 */
import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2, MailCheck } from "lucide-react";
import AvaranaLogo from "../../../components/common/AvaranaLogo/AvaranaLogo";
import { useVerifyOtp, useResendOtp } from "../hooks/useAuth";
import "./auth.styles.css";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function VerifyOTP() {
  const { verifyOtp, loading, error, pendingEmail } = useVerifyOtp();
  const { resendOtp, loading: resendLoading } = useResendOtp();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const focusBox = (index) => inputRefs.current[index]?.focus();

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < OTP_LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        focusBox(index - 1);
      }
    }
    if (e.key === "ArrowLeft" && index > 0) focusBox(index - 1);
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) focusBox(index + 1);
  };

  // Handle paste (e.g. from email)
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split("").forEach((ch, i) => (next[i] = ch));
    setDigits(next);
    focusBox(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) return;
    verifyOtp({ email: pendingEmail, otp });
  };

  const handleResend = () => {
    if (!pendingEmail || countdown > 0) return;
    resendOtp(pendingEmail);
    setCountdown(RESEND_COOLDOWN);
  };

  const otpComplete = digits.every(Boolean);

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb--1" />
      <div className="auth-bg-orb auth-bg-orb--2" />

      <div className="auth-card">
        <Link to="/register" className="auth-back">
          <ArrowLeft size={14} /> Back to register
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
            <MailCheck size={26} color="#D4AF7A" />
          </div>
        </div>

        <h1 className="auth-heading" style={{ textAlign: "center" }}>
          Check your email
        </h1>
        <p className="auth-sub" style={{ textAlign: "center" }}>
          We sent a 6-digit verification code to
        </p>
        {pendingEmail && (
          <div style={{ textAlign: "center" }}>
            <span className="auth-email-badge">{pendingEmail}</span>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-otp-group" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                id={`otp-box-${i}`}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="auth-otp-input"
                value={digit}
                onChange={(e) => handleChange(e, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                autoFocus={i === 0}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <button
            id="verify-otp-btn"
            type="submit"
            className="auth-btn auth-btn--primary"
            disabled={loading || !otpComplete}
            style={{ marginTop: "0.25rem" }}
          >
            {loading ? (
              <Loader2 size={18} className="auth-spinner" />
            ) : (
              <>
                <ShieldCheck size={18} />
                Verify Email
              </>
            )}
          </button>
        </form>

        {/* Resend */}
        <div className="auth-resend-row">
          <span>Didn&apos;t get the code?</span>
          <button
            className="auth-resend-btn"
            onClick={handleResend}
            disabled={countdown > 0 || resendLoading}
          >
            {resendLoading ? "Sending…" : "Resend"}
          </button>
          {countdown > 0 && (
            <span className="auth-timer">
              in <strong>{countdown}s</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

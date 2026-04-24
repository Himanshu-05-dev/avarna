/* ─────────────────────────────────────────────────────────────────────────────
   YourCrawl — Transactional Email Templates
   Palette mirrors auth.styles.css exactly:
     bg         #0a0a0a  (page background)
     card       #111111  (auth-card)
     surface    #0c0c0c  (input/otp background)
     border     #1e1e1e  (card border)
     border-dim #2a2a2a  (input border)
     accent     #D4AF7A  (gold — primary accent)
     text       #ffffff
     text-dim   rgba(255,255,255,0.45)
     text-muted rgba(255,255,255,0.25)
   Font: Inter (web-safe fallback: Arial)
───────────────────────────────────────────────────────────────────────────── */

const year = new Date().getFullYear();

// ── Shared wrapper ────────────────────────────────────────────────────────────
const baseWrapper = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>YourCrawl</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #1e1e1e;border-top:3px solid #D4AF7A;box-shadow:0 32px 80px rgba(0,0,0,0.6);">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e1e;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;letter-spacing:0.2em;color:#D4AF7A;">YOURCRAWL</span>
              </td>
              <td align="right">
                <span style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.2);font-family:'Courier New',monospace;">WEB INTELLIGENCE</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Dynamic body -->
        ${content}

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #1e1e1e;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.7;letter-spacing:0.03em;">
            &copy; ${year} YourCrawl &mdash; All rights reserved.<br>
            <span style="color:rgba(255,255,255,0.12);">You received this email because an action was performed on your account. If this wasn't you, please ignore this message.</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();


// ── 1. Email Verification (link-based) ────────────────────────────────────────
export function verifyEmailTemplate({ username, verificationLink, otp }) {
  const digitBoxes = otp
    ? otp
        .split("")
        .map(
          (d) =>
            `<td style="padding:0 3px;">
               <div style="width:44px;height:56px;line-height:56px;text-align:center;background:#0c0c0c;border:1px solid #2a2a2a;font-size:26px;font-weight:700;color:#D4AF7A;font-family:'Courier New',monospace;display:inline-block;">${d}</div>
             </td>`
        )
        .join("")
    : "";

  const content = `
    <tr><td style="padding:40px 40px 36px;">

      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#D4AF7A;font-weight:600;">Account Activation</p>
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;">Verify your<br>email address</h1>

      <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.8;">
        Hey <strong style="color:#ffffff;">${username}</strong>, welcome to YourCrawl.<br>
        Use the code below or click the button to confirm your email and activate your account.
      </p>

      ${
        otp
          ? `
      <!-- OTP Digit Boxes -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>${digitBoxes}</tr>
      </table>

      <!-- Plain-text OTP fallback -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#0c0c0c;border:1px solid #2a2a2a;padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Verification Code</p>
          <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#D4AF7A;font-family:'Courier New',monospace;">${otp}</p>
        </td></tr>
      </table>
      `
          : ""
      }

      <!-- CTA Button -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#D4AF7A;">
          <a href="${verificationLink}"
             style="display:inline-block;padding:14px 36px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#000000;text-decoration:none;">
            Verify Email &rarr;
          </a>
        </td></tr>
      </table>

      <!-- Fallback link -->
      <p style="margin:0 0 24px;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.7;">
        Or paste this link into your browser:<br>
        <a href="${verificationLink}" style="color:#D4AF7A;word-break:break-all;">${verificationLink}</a>
      </p>

      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
        ${otp ? 'The verification code expires in <strong style="color:rgba(255,255,255,0.45);">5 minutes</strong>, and the link expires' : 'This link expires'} in <strong style="color:rgba(255,255,255,0.45);">24 hours</strong>.
        If you didn&apos;t create an account, you can safely ignore this email.
      </p>

    </td></tr>`;
  return baseWrapper(content);
}


// ── 2. OTP Verification / Resend ──────────────────────────────────────────────
export function otpVerifyTemplate({ otp }) {
  const digitBoxes = otp
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 3px;">
           <div style="width:44px;height:56px;line-height:56px;text-align:center;background:#0c0c0c;border:1px solid #2a2a2a;font-size:26px;font-weight:700;color:#D4AF7A;font-family:'Courier New',monospace;display:inline-block;">${d}</div>
         </td>`
    )
    .join("");

  const content = `
    <tr><td style="padding:40px 40px 36px;">

      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#D4AF7A;font-weight:600;">Email Verification</p>
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;">Your one-time<br>verification code</h1>

      <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.8;">
        Use the code below to verify your identity. It expires in
        <strong style="color:#ffffff;">5 minutes</strong>.
        Do not share it with anyone.
      </p>

      <!-- OTP Digit Boxes -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>${digitBoxes}</tr>
      </table>

      <!-- Plain-text fallback for email clients -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#0c0c0c;border:1px solid #2a2a2a;padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Verification Code</p>
          <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#D4AF7A;font-family:'Courier New',monospace;">${otp}</p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
        If you didn&apos;t request this code, you can safely ignore this email.
      </p>

    </td></tr>`;
  return baseWrapper(content);
}


// ── 3. Forgot / Reset Password ────────────────────────────────────────────────
export function resetPasswordTemplate({ otp, resetUrl }) {
  const digitBoxes = otp
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 3px;">
           <div style="width:44px;height:56px;line-height:56px;text-align:center;background:#0c0c0c;border:1px solid #2a2a2a;font-size:26px;font-weight:700;color:#D4AF7A;font-family:'Courier New',monospace;display:inline-block;">${d}</div>
         </td>`
    )
    .join("");

  const content = `
    <tr><td style="padding:40px 40px 36px;">

      <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#D4AF7A;font-weight:600;">Security Alert</p>
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;">Reset your<br>password</h1>

      <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.8;">
        We received a request to reset your YourCrawl password.<br>
        Use the code below or click the button &mdash; both expire in
        <strong style="color:#ffffff;">5 minutes</strong>.
      </p>

      <!-- OTP Digit Boxes -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>${digitBoxes}</tr>
      </table>

      <!-- Plain-text OTP fallback -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#0c0c0c;border:1px solid #2a2a2a;padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Reset Code</p>
          <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#D4AF7A;font-family:'Courier New',monospace;">${otp}</p>
        </td></tr>
      </table>

      <!-- CTA Button -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#D4AF7A;">
          <a href="${resetUrl}"
             style="display:inline-block;padding:14px 36px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#000000;text-decoration:none;">
            Reset Password &rarr;
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
        If you didn&apos;t request a password reset, ignore this email &mdash;
        your password will remain unchanged.
      </p>

    </td></tr>`;
  return baseWrapper(content);
}

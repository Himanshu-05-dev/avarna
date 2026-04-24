import "./AvaranaLogo.css";

/**
 * AvaranaLogo — Reusable brand identity component.
 * Renders the lotus/third-eye SVG symbol alongside the Avarana wordmark.
 *
 * Props:
 *   size      — pixel size of the SVG icon (default: 36)
 *   showName  — whether to render the text wordmark (default: true)
 *   showSub   — whether to render the subtitle (default: true)
 *   inline    — compact horizontal layout for navbars (default: false)
 *   className — extra class on the root wrapper
 */
export default function AvaranaLogo({
  size = 36,
  showName = true,
  showSub = true,
  inline = false,
  className = "",
}) {
  return (
    <div
      className={`avarana-logo ${inline ? "avarana-logo--inline" : ""} ${className}`}
      role="img"
      aria-label="Avarana – Dark Pattern Auditor"
    >
      {/* ── Lotus / Third-eye Symbol ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <radialGradient id="al-bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1A102E" />
            <stop offset="100%" stopColor="#050310" />
          </radialGradient>
        </defs>

        {/* Background */}
        <circle cx="200" cy="200" r="192" fill="url(#al-bgGlow)" />
        <circle cx="200" cy="200" r="192" fill="none" stroke="#C88A10" strokeWidth="1.4" opacity="0.65" />
        <circle cx="200" cy="200" r="185" fill="none" stroke="#C88A10" strokeWidth="0.4" opacity="0.2" />
        <circle cx="200" cy="200" r="178" fill="none" stroke="#C88A10" strokeWidth="0.3" opacity="0.12" />

        {/* Outer petals (8) */}
        <g transform="translate(200,200)" fill="#8A6008" stroke="#B87A10" strokeWidth="0.6" opacity="0.8">
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
            <path key={deg} d="M0 0 C-28-42-24-98 0-152 C24-98 28-42 0 0" transform={`rotate(${deg})`} />
          ))}
        </g>

        {/* Outer petal center veins */}
        <g transform="translate(200,200)" stroke="#D4920E" strokeWidth="0.5" fill="none" opacity="0.22">
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
            <line key={deg} x1="0" y1="-8" x2="0" y2="-148" transform={`rotate(${deg})`} />
          ))}
        </g>

        {/* Inner petals (8) */}
        <g transform="translate(200,200)" fill="#D4920E" stroke="#E8A840" strokeWidth="0.6" opacity="0.92">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <path key={deg} d="M0 0 C-16-26-13-60 0-94 C13-60 16-26 0 0" transform={`rotate(${deg})`} />
          ))}
        </g>

        {/* Inner petal veins */}
        <g transform="translate(200,200)" stroke="#F0C860" strokeWidth="0.4" fill="none" opacity="0.28">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="0" y1="-6" x2="0" y2="-90" transform={`rotate(${deg})`} />
          ))}
        </g>

        {/* Pericarp ring */}
        <circle cx="200" cy="200" r="38" fill="#0A0720" stroke="#C88A10" strokeWidth="0.8" opacity="0.9" />
        <circle cx="200" cy="200" r="30" fill="none" stroke="#C88A10" strokeWidth="0.4" opacity="0.35" />

        {/* Stamen dots */}
        <g fill="#E8A840" opacity="0.55">
          <circle cx="200" cy="163" r="2.8" />
          <circle cx="226.2" cy="173.8" r="2.2" />
          <circle cx="237" cy="200" r="2.8" />
          <circle cx="226.2" cy="226.2" r="2.2" />
          <circle cx="200" cy="237" r="2.8" />
          <circle cx="173.8" cy="226.2" r="2.2" />
          <circle cx="163" cy="200" r="2.8" />
          <circle cx="173.8" cy="173.8" r="2.2" />
        </g>

        {/* Eye dark fill */}
        <path d="M150 200 Q200 173 250 200 Q200 227 150 200 Z" fill="#0A0720" />
        {/* Eye white region */}
        <path d="M150 200 Q200 173 250 200 Q200 227 150 200 Z" fill="#0F0A28" />
        {/* Eye outline */}
        <path d="M150 200 Q200 173 250 200 Q200 227 150 200 Z" fill="none" stroke="#E8A840" strokeWidth="1.8" />
        {/* Upper eyelid crease */}
        <path d="M158 196 Q200 167 242 196" fill="none" stroke="#E8A840" strokeWidth="0.7" opacity="0.3" />

        {/* Iris */}
        <circle cx="200" cy="200" r="18" fill="none" stroke="#E8A840" strokeWidth="1.3" />
        <circle cx="200" cy="200" r="14" fill="#C88A10" opacity="0.18" />

        {/* Pupil */}
        <circle cx="200" cy="200" r="9" fill="#D4920E" />
        <circle cx="200" cy="200" r="5" fill="#050310" />
        <circle cx="205" cy="196" r="2.2" fill="#F5E8C0" opacity="0.92" />
        <circle cx="196" cy="203" r="1.2" fill="#F5E8C0" opacity="0.4" />

        {/* Corner dots */}
        <circle cx="151" cy="200" r="2" fill="#C88A10" opacity="0.7" />
        <circle cx="249" cy="200" r="2" fill="#C88A10" opacity="0.7" />
      </svg>

      {/* ── Wordmark ── */}
      {showName && (
        <div className="avarana-logo__text">
          <div className="avarana-logo__wordmark">
            <span className="avarana-logo__avar">Avar</span>
            <span className="avarana-logo__rana">रण</span>
          </div>
          {showSub && (
            <div className="avarana-logo__sub">Dark Pattern Auditor</div>
          )}
        </div>
      )}
    </div>
  );
}

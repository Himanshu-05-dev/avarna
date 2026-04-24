import { useEffect, useState } from "react";
import "./WelcomeAnimation.css";

const OUTER_COUNT = 12;
const INNER_COUNT = 8;
const ACCENT_COUNT = 6;

// Lotus petal SVG path — pointed tip, wide base
function OuterPetalSVG({ idx }) {
  return (
    <svg viewBox="0 0 50 140" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <linearGradient id={`og-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f7d060" />
          <stop offset="45%"  stopColor="#c8960a" />
          <stop offset="100%" stopColor="#6b4700" />
        </linearGradient>
        <linearGradient id={`ogl-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(255,220,80,0.45)" />
          <stop offset="50%"  stopColor="rgba(255,220,80,0)" />
          <stop offset="100%" stopColor="rgba(255,220,80,0.2)" />
        </linearGradient>
        <filter id={`glow-o-${idx}`}>
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Main petal shape */}
      <path
        d="M25 2 C35 30, 44 70, 25 138 C6 70, 15 30, 25 2 Z"
        fill={`url(#og-${idx})`}
        filter={`url(#glow-o-${idx})`}
      />
      {/* Center vein */}
      <path
        d="M25 8 C25 50, 25 90, 25 132"
        fill="none"
        stroke="rgba(255,230,100,0.35)"
        strokeWidth="1.2"
      />
      {/* Left vein */}
      <path d="M25 30 C20 60, 16 90, 14 120" fill="none" stroke="rgba(255,230,100,0.15)" strokeWidth="0.6"/>
      {/* Right vein */}
      <path d="M25 30 C30 60, 34 90, 36 120" fill="none" stroke="rgba(255,230,100,0.15)" strokeWidth="0.6"/>
      {/* Shimmer overlay */}
      <path
        d="M25 2 C35 30, 44 70, 25 138 C6 70, 15 30, 25 2 Z"
        fill={`url(#ogl-${idx})`}
      />
    </svg>
  );
}

function InnerPetalSVG({ idx }) {
  return (
    <svg viewBox="0 0 38 104" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <linearGradient id={`ig-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ffe066" />
          <stop offset="40%"  stopColor="#e6a800" />
          <stop offset="100%" stopColor="#7a5500" />
        </linearGradient>
        <filter id={`glow-i-${idx}`}>
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path
        d="M19 2 C27 24, 33 56, 19 102 C5 56, 11 24, 19 2 Z"
        fill={`url(#ig-${idx})`}
        filter={`url(#glow-i-${idx})`}
      />
      <path
        d="M19 6 C19 40, 19 68, 19 98"
        fill="none"
        stroke="rgba(255,240,120,0.4)"
        strokeWidth="1"
      />
    </svg>
  );
}

function AccentPetalSVG({ idx }) {
  return (
    <svg viewBox="0 0 22 76" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <linearGradient id={`ag-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fff0a0" />
          <stop offset="60%"  stopColor="#f5c842" />
          <stop offset="100%" stopColor="#a07010" />
        </linearGradient>
      </defs>
      <path
        d="M11 1 C16 18, 19 42, 11 75 C3 42, 6 18, 11 1 Z"
        fill={`url(#ag-${idx})`}
        opacity="0.8"
      />
    </svg>
  );
}

export default function WelcomeAnimation({ onComplete }) {
  const [phase, setPhase] = useState("init");
  // init → open-outer → open-inner → open-accent → hold → exit → done

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("open-outer"),  300),
      setTimeout(() => setPhase("open-inner"),  900),
      setTimeout(() => setPhase("open-accent"), 1500),
      setTimeout(() => setPhase("hold"),        2000),
      setTimeout(() => setPhase("exit"),        4000),
      setTimeout(() => { setPhase("done"); onComplete?.(); }, 5400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (phase === "done") return null;

  const isOpen   = ["open-inner","open-accent","hold","exit"].includes(phase);
  const accentOpen = ["open-accent","hold","exit"].includes(phase);
  const isExit   = phase === "exit";

  return (
    <div className={`wa-overlay${isExit ? " wa-exit" : ""}`}>

      {/* Grain overlay */}
      <div className="wa-grain" />

      {/* Ambient radial pulse */}
      <div className={`wa-pulse${isOpen ? " wa-pulse--active" : ""}`} />

      {/* Floating dust particles */}
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="wa-dust" style={{ "--i": i }} />
      ))}

      <div className="wa-scene">

        {/* ── Outer petal ring ─────────────────────────── */}
        <div className={`wa-ring wa-ring--outer${isOpen ? " wa-ring--open" : ""}`}>
          {Array.from({ length: OUTER_COUNT }).map((_, i) => (
            <div
              key={i}
              className="wa-petal wa-petal--outer"
              style={{
                "--idx":   i,
                "--total": OUTER_COUNT,
                "--delay": `${i * 0.04}s`,
              }}
            >
              <OuterPetalSVG idx={i} />
            </div>
          ))}
        </div>

        {/* ── Inner petal ring ─────────────────────────── */}
        <div className={`wa-ring wa-ring--inner${isOpen ? " wa-ring--open" : ""}`}>
          {Array.from({ length: INNER_COUNT }).map((_, i) => (
            <div
              key={i}
              className="wa-petal wa-petal--inner"
              style={{
                "--idx":   i,
                "--total": INNER_COUNT,
                "--delay": `${i * 0.05 + 0.1}s`,
              }}
            >
              <InnerPetalSVG idx={i} />
            </div>
          ))}
        </div>

        {/* ── Accent (narrow) petals ────────────────────── */}
        <div className={`wa-ring wa-ring--accent${accentOpen ? " wa-ring--open" : ""}`}>
          {Array.from({ length: ACCENT_COUNT }).map((_, i) => (
            <div
              key={i}
              className="wa-petal wa-petal--accent"
              style={{
                "--idx":   i,
                "--total": ACCENT_COUNT,
                "--delay": `${i * 0.06}s`,
              }}
            >
              <AccentPetalSVG idx={i} />
            </div>
          ))}
        </div>

        {/* ── Center disc ───────────────────────────────── */}
        <div className={`wa-center${isOpen ? " wa-center--open" : ""}${isExit ? " wa-center--exit" : ""}`}>
          <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" className="wa-disc-svg">
            <defs>
              <radialGradient id="discBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#241900" />
                <stop offset="70%"  stopColor="#140e00" />
                <stop offset="100%" stopColor="#080500" />
              </radialGradient>
              <radialGradient id="irisG" cx="38%" cy="38%" r="60%">
                <stop offset="0%"   stopColor="#ffd740" />
                <stop offset="55%"  stopColor="#c8960a" />
                <stop offset="100%" stopColor="#5c3a00" />
              </radialGradient>
              <filter id="eyeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="outerGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feColorMatrix in="blur" type="matrix" values="1 0.8 0 0 0  0.8 0.6 0 0 0  0 0 0 0 0  0 0 0 0.7 0" result="colored"/>
                <feMerge><feMergeNode in="colored"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <clipPath id="eyeClip">
                <ellipse cx="80" cy="80" rx="36" ry="21" />
              </clipPath>
            </defs>

            {/* Outer glow disc */}
            <circle cx="80" cy="80" r="74" fill="rgba(200,150,10,0.08)" filter="url(#outerGlow)" />

            {/* Main disc */}
            <circle cx="80" cy="80" r="70" fill="url(#discBg)" />

            {/* Outer gold ring */}
            <circle cx="80" cy="80" r="68" fill="none" stroke="#c8960a" strokeWidth="1.2" opacity="0.9" />

            {/* Gear teeth */}
            {Array.from({ length: 20 }).map((_, i) => {
              const a = (i / 20) * Math.PI * 2;
              const r1 = 62, r2 = 68;
              const x1 = 80 + Math.cos(a) * r1, y1 = 80 + Math.sin(a) * r1;
              const x2 = 80 + Math.cos(a) * r2, y2 = 80 + Math.sin(a) * r2;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8960a" strokeWidth="2.5" opacity="0.7" />;
            })}

            {/* Inner rings */}
            <circle cx="80" cy="80" r="56" fill="none" stroke="#f5c842" strokeWidth="0.6" opacity="0.3" />
            <circle cx="80" cy="80" r="50" fill="none" stroke="#c8960a" strokeWidth="0.8" opacity="0.25" strokeDasharray="3 6" />

            {/* Orbit ring */}
            <circle cx="80" cy="80" r="43" fill="none" stroke="#f5c842" strokeWidth="0.7" opacity="0.35" strokeDasharray="2 5" />
            {/* Orbit dot */}
            <circle cx="80" cy="37" r="2.5" fill="#ffd740" opacity="0.9" />

            {/* Eye white / socket */}
            <ellipse cx="80" cy="80" rx="36" ry="21" fill="#120c00" />

            {/* Iris */}
            <circle cx="80" cy="80" r="16" fill="url(#irisG)" filter="url(#eyeGlow)" />

            {/* Iris rings */}
            <circle cx="80" cy="80" r="13" fill="none" stroke="rgba(255,230,100,0.35)" strokeWidth="0.8" />
            <circle cx="80" cy="80" r="10" fill="none" stroke="rgba(255,230,100,0.15)" strokeWidth="0.5" />

            {/* Pupil */}
            <circle cx="80" cy="80" r="7" fill="#050300" />
            {/* Highlight */}
            <circle cx="74" cy="74" r="2.8" fill="rgba(255,255,255,0.7)" />
            <circle cx="84" cy="83" r="1.2" fill="rgba(255,255,255,0.35)" />

            {/* Upper eyelid line */}
            <path d="M44 77 Q80 56 116 77" fill="none" stroke="#c8960a" strokeWidth="1.5" opacity="0.8" />
            {/* Lower eyelid line */}
            <path d="M44 83 Q80 104 116 83" fill="none" stroke="#c8960a" strokeWidth="1.5" opacity="0.8" />

            {/* Lash marks – upper */}
            {[48, 58, 70, 80, 90, 102, 112].map((x, i) => {
              const t = (x - 44) / 72;
              const cy = 77 - Math.sin(t * Math.PI) * 21 * 0.5;
              return <line key={i} x1={x} y1={cy} x2={x} y2={cy - 5} stroke="#c8960a" strokeWidth="1" opacity="0.5" />;
            })}
            {/* Lash marks – lower */}
            {[52, 64, 76, 88, 100].map((x, i) => {
              const t = (x - 44) / 72;
              const cy = 83 + Math.sin(t * Math.PI) * 21 * 0.5;
              return <line key={i} x1={x} y1={cy} x2={x} y2={cy + 4} stroke="#c8960a" strokeWidth="1" opacity="0.45" />;
            })}

            {/* Corner dots */}
            <circle cx="44" cy="80" r="2" fill="#c8960a" opacity="0.7" />
            <circle cx="116" cy="80" r="2" fill="#c8960a" opacity="0.7" />
          </svg>

          {/* Rotating halo ring outside disc */}
          <div className="wa-halo" />
        </div>

        {/* ── Brand name ────────────────────────────────── */}
        <div className={`wa-brand${isOpen ? " wa-brand--open" : ""}${isExit ? " wa-brand--exit" : ""}`}>
          <div className="wa-brand-name">
            <span className="wa-en">Avar</span><span className="wa-hi">रण</span>
          </div>
          <div className="wa-tagline">DARK PATTERN AUDITOR</div>
        </div>

      </div>
    </div>
  );
}

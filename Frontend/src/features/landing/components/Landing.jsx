import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  ShieldAlert,
  Brain,
  ShieldCheck,
  Activity,
  GitBranch,
  AlertTriangle,
} from "lucide-react";
import AvaranaLogo from "../../../components/common/AvaranaLogo/AvaranaLogo";
import TopNav from "../../../components/layout/TopNav/TopNav";
import Footer from "../../../components/layout/Footer/Footer";
import { Button } from "../../../components/common/button";

function HeroMockDashboard() {
  return (
    <div
      data-testid="hero-dashboard-mock"
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 shadow-2xl ring-1 ring-slate-700"
    >
      <div className="flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-slate-200">Safe</span>
          <span>Safe work</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
          <span>DE 49X</span>
        </div>
      </div>
      <div className="mt-5 h-[2px] w-full bg-slate-700/70" />

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-3 text-[10px] uppercase tracking-widest text-slate-500">
            Transactions signed
          </div>
          <div className="flex h-[140px] items-end gap-[10px]">
            {[60, 50, 78, 45, 92, 70, 110, 65, 100, 85, 120, 95].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="w-2 rounded-sm bg-sky-400/70"
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 text-[10px] uppercase tracking-widest text-slate-500">
            Forecast exposure
          </div>
          <svg viewBox="0 0 200 140" className="h-[140px] w-full">
            <defs>
              <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,110 L20,95 L40,100 L60,80 L80,85 L100,65 L120,75 L140,55 L160,45 L180,30 L200,22 L200,140 L0,140 Z"
              fill="url(#ga)"
            />
            <path
              d="M0,110 L20,95 L40,100 L60,80 L80,85 L100,65 L120,75 L140,55 L160,45 L180,30 L200,22"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-[11px] text-slate-400">
        <div className="space-y-1.5">
          {["Engagement", "Authentication", "Deceptive flow"].map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>{t}</span>
              <span className="text-slate-500">0.{3 + i}x</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {["Session", "CSAT", "Churn"].map((t, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>{t}</span>
              <span className="text-slate-500">{62 - i * 4}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-6 -left-4 w-[260px] rotate-[-3deg] rounded-xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-500">
              Critical Risk
            </div>
            <div className="text-[15px] font-bold text-slate-900">
              Dark Pattern Found
            </div>
          </div>
        </div>
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-rose-500 to-rose-700" />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Remediation suggested. 4 actions
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function FeatureCard({ icon: Icon, title, desc, extra, testId }) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <h3 className="mt-6 text-[20px] font-bold leading-tight text-slate-900">
        {title}
      </h3>
      <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-slate-500">
        {desc}
      </p>
      {extra}
    </div>
  );
}

function Steps() {
  const steps = [
    {
      n: "01",
      title: "Input Domain",
      desc: "Provide your production URL or Figma prototypes. Our agent begins a deep-crawl traversal of all states.",
      extra: (
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 font-mono text-[12px] text-slate-500">
          aegis-audit --crawl https://app.target.com
        </div>
      ),
    },
    {
      n: "02",
      title: "Pattern Discovery",
      desc: "The auditor identifies deceptive friction, misaligned visual hierarchies, and pre-ticked deceptive options.",
      extra: (
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-md bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-600">
            Sneak into basket
          </span>
          <span className="rounded-md bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
            Bait &amp; Switch
          </span>
        </div>
      ),
    },
    {
      n: "03",
      title: "Remediation Guide",
      desc: "Get a structured PDF report and automated pull requests with design system corrections ready to merge.",
      extra: (
        <button className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-blue-600 hover:underline">
          Download Sample Report ↓
        </button>
      ),
    },
  ];
  return (
    <div className="mx-auto mt-20 grid max-w-[1200px] grid-cols-1 gap-12 px-8 md:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="relative">
          <div className="absolute -top-8 left-0 text-[64px] font-black text-slate-100">
            {s.n}
          </div>
          <div className="relative pt-4">
            <h4 className="text-[17px] font-bold text-slate-900">{s.title}</h4>
            <p className="mt-3 max-w-[340px] text-[13px] leading-relaxed text-slate-500">
              {s.desc}
            </p>
            {s.extra}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [ctaHover, setCtaHover] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <TopNav showSearch={false} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-50">
        <div className="pointer-events-none absolute inset-0 bg-grid-slate opacity-60" />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-8 py-20 md:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/70 px-3 py-1 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-200">
              <ShieldAlert className="h-[14px] w-[14px]" />
              Institutional Risk Detection
            </div>
            <h1 className="mt-6 text-[44px] font-extrabold leading-[1.08] tracking-tight text-slate-900 md:text-[56px]">
              Expose deceptive UI with{" "}
              <span style={{ color: "#C88A10" }}>Autonomous</span> dark pattern
              detection.
            </h1>
            <p className="mt-6 max-w-[540px] text-[15px] leading-relaxed text-slate-600">
              Avarana empowers compliance teams to identify, categorize,
              and remediate manipulative user interfaces before they become
              legal liabilities.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/dashboard">
                <Button
                  data-testid="launch-free-audit-btn"
                  onMouseEnter={() => setCtaHover(true)}
                  onMouseLeave={() => setCtaHover(false)}
                  className="h-11 rounded-lg bg-blue-600 px-5 text-[14px] font-semibold hover:bg-blue-700"
                >
                  Launch Free Audit
                  <ArrowRight
                    className={`ml-2 h-4 w-4 transition-transform ${
                      ctaHover ? "translate-x-1" : ""
                    }`}
                  />
                </Button>
              </Link>
              <Link to="/compliance">
                <Button
                  data-testid="view-compliance-demo-btn"
                  variant="outline"
                  className="h-11 rounded-lg border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-900 hover:bg-slate-50"
                >
                  View Compliance Demo
                </Button>
              </Link>
            </div>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <HeroMockDashboard />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-[900px] px-8 text-center">
          <h2 className="text-[36px] font-extrabold tracking-tight text-slate-900 md:text-[42px]">
            Surgical Precision in Every Scan
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[15px] leading-relaxed text-slate-500">
            Our engine goes beyond simple accessibility checks. We analyze
            intent, friction, and choice architecture to find hidden
            manipulation.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-[1200px] grid-cols-1 gap-6 px-8 md:grid-cols-2">
          <FeatureCard
            testId="feature-heuristic"
            icon={Brain}
            title="Heuristic Intent Analysis"
            desc={`AI-powered behavioral modeling that identifies "Roach Motels" and "Forced Continuity" by simulating user journeys through high-stakes funnels.`}
            extra={
              <div className="mt-8 overflow-hidden rounded-xl bg-gradient-to-b from-slate-200 to-slate-100 p-4 ring-1 ring-slate-200">
                <div className="grid grid-cols-6 gap-[6px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-5 rounded-sm bg-slate-300/60"
                      style={{ opacity: 0.2 + (i % 6) * 0.12 }}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-6 gap-[6px]">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 rounded-sm bg-slate-400/50"
                      style={{ opacity: 0.3 + (i % 6) * 0.1 }}
                    />
                  ))}
                </div>
              </div>
            }
          />

          <div className="flex flex-col gap-6">
            <FeatureCard
              testId="feature-compliance"
              icon={ShieldCheck}
              title="Institutional Compliance"
              desc="Mapped directly to GDPR, CCPA, and upcoming EU AI Act transparency requirements."
            />
            <div className="grid grid-cols-2 gap-6">
              <FeatureCard
                testId="feature-audit-trails"
                icon={Activity}
                title="Audit Trails"
                desc="Immutable logs for internal risk management."
              />
              <FeatureCard
                testId="feature-cicd"
                icon={GitBranch}
                title="CI/CD Hooks"
                desc="Fail builds when dark patterns are introduced."
              />
            </div>
          </div>
        </div>

        <Steps />
      </section>

      {/* CTA Banner */}
      <section className="bg-white px-8 pb-24">
        <div className="mx-auto max-w-[1200px] rounded-3xl bg-linear-to-br from-blue-600 to-blue-700 px-10 py-14 text-center text-white shadow-lg">
          <h3 className="text-[34px] font-extrabold tracking-tight md:text-[40px]">
            Secure your choice architecture.
          </h3>
          <p className="mx-auto mt-4 max-w-[620px] text-[14px] text-blue-100">
            Join over 400 institutional compliance teams who rely on Avarana
            to maintain ethical UX standards at scale.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              data-testid="cta-trial-btn"
              className="h-11 rounded-lg px-6 text-[14px] text-blue-700 hover:bg-slate-200"
              variant="outline"
            >
              Start Free Enterprise Trial
            </Button>
            <Button
              data-testid="cta-contact-btn"
              className="h-11 rounded-lg px-6 text-[14px] text-white ring-1 ring-white/30 hover:bg-blue-900"
              style={{ backgroundColor: "#1e40af" }}
            >
              Talk to an Auditor
            </Button>
          </div>
        </div>
      </section>

      <Footer variant="landing" />
    </div>
  );
}

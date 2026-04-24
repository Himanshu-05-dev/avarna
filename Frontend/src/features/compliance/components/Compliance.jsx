import { useState } from "react";
import { useSelector } from "react-redux";
import {
  ShieldCheck, Scale, Lock, FileCheck, Cpu, ListChecks, Download, AlertCircle,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import { Button } from "../../../components/common/button";
import { toast } from "sonner";
import { generateLegalPDF } from "../../../utils/generateLegalPDF";
import {
  selectComplianceFrameworks,
  selectAuditStatus,
  selectAuditData,
} from "../../audit/state/audit.slice";

const iconMap = {
  "shield-check": ShieldCheck,
  scale:          Scale,
  lock:           Lock,
  "file-check":   FileCheck,
  cpu:            Cpu,
  "list-checks":  ListChecks,
};

function scoreTone(score) {
  if (score >= 85) return { bar: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 70) return { bar: "bg-blue-600",    text: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"    };
  return                  { bar: "bg-orange-500",  text: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200"  };
}

function FrameworkCard({ f }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[f.icon] ?? ShieldCheck;
  const tone = scoreTone(f.score);
  const pct  = f.controls > 0 ? Math.round((f.passed / f.controls) * 100) : f.score;
  const hasExplanation = !!f.explanation;

  return (
    <div
      data-testid={`compliance-${f.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <span className={`text-[30px] font-extrabold leading-none ${tone.text}`}>
          {f.score}
        </span>
      </div>
      <div className="mt-5 text-[17px] font-bold text-slate-900">{f.name}</div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${f.score}%` }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-[12.5px] text-slate-500">
        <span>
          {f.passed} / {f.controls} controls passed
        </span>
        <span className="font-semibold text-slate-700">{pct}%</span>
      </div>

      {/* AI Explanation toggle */}
      {hasExplanation && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 flex w-full items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            <Info className="h-3.5 w-3.5" />
            {expanded ? "Hide AI Analysis" : "View AI Analysis"}
            {expanded ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
          </button>
          {expanded && (
            <div className={`mt-3 rounded-lg ${tone.bg} border ${tone.border} p-4`}>
              <p className="text-[12.5px] leading-relaxed text-slate-700">
                {f.explanation}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Compliance() {
  const frameworks = useSelector(selectComplianceFrameworks);
  const auditStatus = useSelector(selectAuditStatus);
  const auditData = useSelector(selectAuditData);

  const hasData = frameworks.length > 0;

  // Compute aggregate stats
  const avgScore = hasData
    ? Math.round(frameworks.reduce((s, f) => s + f.score, 0) / frameworks.length)
    : null;
  const totalControls = frameworks.reduce((s, f) => s + (f.controls || 0), 0);
  const totalPassed   = frameworks.reduce((s, f) => s + (f.passed  || 0), 0);

  return (
    <AppLayout>
      <div id="compliance-report-content" className="relative h-full min-h-[calc(100vh-100px)] p-4 bg-[#FAFAFA]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900">
            Compliance Posture
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Framework-by-framework breakdown of current regulatory coverage.
          </p>
        </div>
        <Button
          data-testid="compliance-export-btn"
          disabled={!hasData}
          onClick={() => generateLegalPDF(auditData, "Formal_Compliance_Report.pdf")}
          className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${
            hasData
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
          }`}
        >
          <Download className="mr-2 h-4 w-4" /> Export Summary
        </Button>
      </div>

      {/* Aggregate stats banner */}
      {hasData && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Average Compliance</div>
            <div className="mt-2 text-[36px] font-extrabold text-slate-900">{avgScore}<span className="text-[16px] text-slate-400">/100</span></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Frameworks Assessed</div>
            <div className="mt-2 text-[36px] font-extrabold text-slate-900">{frameworks.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Controls Passed</div>
            <div className="mt-2 text-[36px] font-extrabold text-slate-900">{totalPassed}<span className="text-[16px] text-slate-400">/{totalControls}</span></div>
          </div>
        </div>
      )}

      {/* Empty / prompt state */}
      {!hasData && (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-slate-400" />
          <div>
            <p className="text-[16px] font-semibold text-slate-700">No compliance data yet</p>
            <p className="mt-1 text-[14px] text-slate-500">
              {auditStatus === "loading"
                ? "Running audit, please wait…"
                : "Run an audit from the Config page to see framework scores."}
            </p>
          </div>
        </div>
      )}

      {/* Info banner */}
      {hasData && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-[12px] text-blue-700">
          <Info className="h-4 w-4 shrink-0" />
          Click "View AI Analysis" on any framework card to see a detailed explanation of the score.
        </div>
      )}

      {/* Framework cards */}
      {hasData && (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((f) => (
            <FrameworkCard key={f.id} f={f} />
          ))}
        </div>
      )}

      {/* Static CTA panel */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-linear-to-br from-slate-900 to-slate-800 p-8 text-white">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-blue-300">
              Audit Readiness
            </div>
            <h3 className="mt-2 text-[28px] font-extrabold">
              Schedule your next external audit
            </h3>
            <p className="mt-2 max-w-[520px] text-[14px] text-slate-300">
              Avarana syncs with your compliance calendar and automatically
              produces pre-audit evidence bundles for external examiners.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Button
              data-testid="schedule-audit-btn"
              onClick={() => toast.success("Scheduler opened")}
              className="h-11 rounded-lg bg-blue-600 px-6 text-[14px] font-semibold hover:bg-blue-500"
            >
              Schedule Audit
            </Button>
            <Button
              data-testid="evidence-bundle-btn"
              variant="outline"
              onClick={() => toast("Evidence bundle generating")}
              className="h-11 rounded-lg border-white/30 bg-transparent px-6 text-[14px] font-semibold text-white hover:bg-white/10"
            >
              Generate Evidence Bundle
            </Button>
          </div>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}

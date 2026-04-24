import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Download, Plus, Sparkles, AlertCircle, Brain, ChevronRight, Shield, Zap, BookOpen } from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import StatCard from "./StatCard/StatCard";
import { Button } from "../../../components/common/button";
import { toast } from "sonner";
import { generateLegalPDF } from "../../../utils/generateLegalPDF";
import {
  selectAuditData,
  selectStatCards,
  selectAuditEntry,
  selectAiInsight,
  selectAuditStatus,
  selectQuickWins,
  selectAnalysisFindings,
  selectExecutiveSummary,
} from "../../audit/state/audit.slice";

const statusStyles = {
  PASS:   "bg-emerald-100 text-emerald-700",
  REVIEW: "bg-amber-100 text-amber-700",
  FAIL:   "bg-rose-100 text-rose-700",
};

const severityToStatus = {
  CRITICAL: { status: "FAIL",   label: "Non-Compliant"      },
  HIGH:     { status: "REVIEW", label: "Partial Compliance"  },
  MEDIUM:   { status: "REVIEW", label: "Review Required"     },
  LOW:      { status: "PASS",   label: "Compliant"           },
};

export default function Dashboard() {
  const navigate      = useNavigate();
  const statCards     = useSelector(selectStatCards);
  const auditEntry    = useSelector(selectAuditEntry);
  const aiInsight     = useSelector(selectAiInsight);
  const auditData     = useSelector(selectAuditData);
  const auditStatus   = useSelector(selectAuditStatus);
  const quickWins     = useSelector(selectQuickWins);
  const findings      = useSelector(selectAnalysisFindings);
  const execSummary   = useSelector(selectExecutiveSummary);
  const hasResults    = !!auditData;

  // Build audit trail rows from real findings (top 5)
  const auditTrailRows = findings.slice(0, 5).map((f) => {
    const s = severityToStatus[f.severity] ?? { status: "REVIEW", label: f.severity };
    return {
      id:       f.id,
      action:   f.entity,
      assessor: { initials: "AI", name: "Avarana AI", color: "bg-blue-600 text-white" },
      status:   s.status,
      date:     f.date,
    };
  });

  return (
    <AppLayout>
      <div id="dashboard-report-content" className="relative h-full min-h-[calc(100vh-100px)] bg-[#FAFAFA] p-4">
        <div className={`transition-all duration-500 ${!hasResults && auditStatus !== "loading" ? "blur-[8px] pointer-events-none opacity-50 select-none" : ""}`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900">
                Security Overview
              </h1>
              <p className="mt-1 text-[14px] text-slate-500">
                {hasResults
                  ? `Last scan: ${auditEntry?.target ?? "—"} · ${auditEntry?.date ?? ""}`
                  : "Real-time compliance posture across all digital assets"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-testid="export-report-btn"
                variant={hasResults ? "default" : "outline"}
                disabled={!hasResults}
                onClick={() => generateLegalPDF(auditData, "Dashboard_Analysis_Report.pdf")}
                className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${
                  hasResults
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <Download className="mr-2 h-4 w-4" /> Export Report
              </Button>
              <Button
                data-testid="start-new-audit-btn"
                onClick={() => navigate("/config")}
                className="h-10 rounded-lg bg-blue-600 text-[13px] font-semibold hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" /> Start New Audit
              </Button>
            </div>
          </div>

          {/* Loading banner */}
          {auditStatus === "loading" && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-50 px-5 py-3 text-[13px] font-semibold text-blue-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              Crawling and analysing — this may take 30–60 seconds…
            </div>
          )}

          {/* ═══ EXECUTIVE SUMMARY — the headline insight ═══ */}
          {hasResults && execSummary && (
            <div
              data-testid="executive-summary-card"
              className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-6"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
                  <Brain className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900">AI Executive Summary</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Powered by Gemini AI</p>
                </div>
              </div>
              <p className="text-[14.5px] leading-[1.75] text-slate-700">
                {execSummary}
              </p>
            </div>
          )}

          {/* Stat Cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              testId="stat-risk-score"
              label="RISK SCORE"
              value={statCards ? String(statCards.risk_score) : "—"}
              delta={statCards ? statCards.risk_score_delta : ""}
              accent="text-blue-600"
              footer={
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${statCards?.risk_score ?? 0}%` }}
                  />
                </div>
              }
            />
            <StatCard
              testId="stat-open-controls"
              label="OPEN CONTROLS"
              value={statCards ? String(statCards.open_controls_critical) : "—"}
              suffix="Critical"
              footer={
                <span>
                  {hasResults
                    ? `${statCards?.total_findings} total findings`
                    : "No audit run yet"}
                </span>
              }
            />
            <StatCard
              testId="stat-findings-breakdown"
              label="FINDINGS"
              value={statCards ? String(statCards.total_findings) : "—"}
              footer={
                statCards ? (
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <span className="text-rose-600">{statCards.critical_count}C</span>
                    <span className="text-orange-500">{statCards.high_count}H</span>
                    <span className="text-blue-600">{statCards.medium_count}M</span>
                    <span className="text-slate-500">{statCards.low_count}L</span>
                  </div>
                ) : (
                  <span>Run an audit to see data</span>
                )
              }
            />
            <StatCard
              testId="stat-elements-scanned"
              label="ELEMENTS SCANNED"
              value={statCards ? String(statCards.total_elements_scanned) : "—"}
              footer={<span>{hasResults ? `Across ${auditEntry?.target ?? "—"}` : "No scan yet"}</span>}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left column */}
            <div className="flex flex-col gap-6">
              {/* ═══ AI DEEP DIVE — the real value ═══ */}
              {hasResults && aiInsight?.deep_dive && (
                <div
                  data-testid="ai-deep-dive-card"
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-slate-900">Dark Pattern Deep Dive</h3>
                      <p className="text-[11px] text-slate-500">Comprehensive analysis of detected manipulation patterns</p>
                    </div>
                  </div>
                  <p className="text-[13.5px] leading-[1.8] text-slate-700">
                    {aiInsight.deep_dive}
                  </p>
                  <button
                    onClick={() => navigate("/analysis")}
                    className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    View Full Analysis <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Audit Trail */}
              <div
                data-testid="audit-trail-card"
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] font-bold text-slate-900">Recent Audit Trail</h2>
                  <button
                    data-testid="view-all-logs-btn"
                    className="text-[13px] font-semibold text-blue-600 hover:underline"
                    onClick={() => navigate("/audits")}
                  >
                    View All Logs
                  </button>
                </div>

                {/* No data state */}
                {!hasResults && (
                  <div className="mt-8 flex flex-col items-center gap-3 py-8 text-center">
                    <AlertCircle className="h-8 w-8 text-slate-300" />
                    <p className="text-[14px] text-slate-500">
                      No audit trail yet. Run your first audit to see results.
                    </p>
                    <Button
                      onClick={() => navigate("/config")}
                      className="mt-1 h-9 rounded-lg bg-blue-600 px-5 text-[13px] font-semibold"
                    >
                      Run Audit
                    </Button>
                  </div>
                )}

                {/* Trail rows */}
                {hasResults && (
                  <div className="mt-5 overflow-hidden">
                    <div className="grid grid-cols-[120px_1.4fr_1fr_90px_90px] gap-4 border-b border-slate-100 pb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <div>Finding ID</div>
                      <div>Pattern</div>
                      <div>Assessor</div>
                      <div>Status</div>
                      <div className="text-right">Date</div>
                    </div>
                    {auditTrailRows.length === 0 && (
                      <p className="py-6 text-center text-[13px] text-slate-500">
                        No findings for this scan.
                      </p>
                    )}
                    {auditTrailRows.map((row) => (
                      <div
                        key={row.id}
                        data-testid={`audit-row-${row.id}`}
                        className="grid grid-cols-[120px_1.4fr_1fr_90px_90px] items-center gap-4 border-b border-slate-50 py-4 text-[13px] text-slate-700 last:border-0"
                      >
                        <div className="font-mono text-[12px] text-slate-500">{row.id}</div>
                        <div className="font-medium text-slate-900 truncate">{row.action}</div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${row.assessor.color}`}
                          >
                            {row.assessor.initials}
                          </span>
                          <span className="text-slate-700">{row.assessor.name}</span>
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusStyles[row.status]}`}
                          >
                            {row.status}
                          </span>
                        </div>
                        <div className="text-right text-slate-500">{row.date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-5">
              {/* Quick Wins */}
              <div
                data-testid="scan-summary-card"
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-[17px] font-bold text-slate-900">
                    {hasResults ? "Quick Wins" : "Scan Summary"}
                  </h3>
                </div>
                <p className="text-[12px] text-slate-500 mb-3">Low-effort, high-impact fixes you can ship today</p>
                {!hasResults && (
                  <p className="mt-3 text-[13px] text-slate-500">
                    Quick-win fixes will appear here after your first audit.
                  </p>
                )}
                {hasResults && quickWins.length === 0 && (
                  <p className="mt-3 text-[13px] text-slate-500">
                    No easy-effort fixes found for this scan.
                  </p>
                )}
                {hasResults && quickWins.length > 0 && (
                  <div className="space-y-2">
                    {quickWins.slice(0, 4).map((win, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-800"
                      >
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        {win}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Insight Card */}
              {aiInsight ? (
                <div
                  data-testid="ai-insight-card"
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="flex items-center gap-2 text-blue-600">
                    <Sparkles className="h-[18px] w-[18px]" />
                    <span className="text-[15px] font-bold text-slate-900">Top Threat Insight</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-rose-600">{aiInsight.title}</p>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
                    {aiInsight.threat_vector}
                  </p>

                  {/* Risk decomposition bars */}
                  <div className="mt-4 space-y-2.5">
                    {[
                      ["Exploitability",    aiInsight?.risk_decomposition?.exploitability    ?? 0, "bg-rose-500"],
                      ["Data Exposure",     aiInsight?.risk_decomposition?.data_exposure     ?? 0, "bg-orange-500"],
                      ["Compliance Impact", aiInsight?.risk_decomposition?.compliance_impact ?? 0, "bg-rose-600"],
                    ].map(([label, level, color]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-slate-600 w-[120px]">{label}</span>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`h-1.5 w-5 rounded-sm ${i < level ? color : "bg-slate-200"}`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border-l-[3px] border-blue-600 bg-blue-50/60 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                      {aiInsight.recommendation_title}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                      {aiInsight.recommendation_body}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate("/analysis")}
                    className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Explore all findings <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-blue-100" />
                    <h3 className="text-[18px] font-bold">Get Started</h3>
                  </div>
                  <p className="max-w-[220px] text-[13px] text-blue-100">
                    Run your first audit to unlock AI-powered dark pattern detection and compliance insights.
                  </p>
                  <Button
                    data-testid="premium-support-btn"
                    onClick={() => navigate("/config")}
                    className="mt-5 h-9 rounded-lg text-[13px] font-semibold text-blue-700 hover:bg-slate-100"
                    variant="secondary"
                  >
                    Start Audit
                  </Button>
                  <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overlay CTA when no data */}
        {!hasResults && auditStatus !== "loading" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="rounded-2xl bg-white/60 p-8 shadow-2xl backdrop-blur-xl border border-white flex flex-col items-center text-center max-w-md mx-auto animate-in fade-in zoom-in duration-500">
              <Shield className="h-14 w-14 text-blue-600 mb-5 drop-shadow-md" />
              <h2 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">No Audit Data Found</h2>
              <p className="text-slate-600 mb-8 text-[14.5px] leading-relaxed">
                Start a new audit to uncover vulnerabilities, dark patterns, and gain AI-powered compliance insights for your application.
              </p>
              <Button
                onClick={() => navigate("/config")}
                className="h-12 w-full rounded-xl bg-blue-600 px-8 text-[15px] font-bold text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300"
              >
                Continue with New Audit <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

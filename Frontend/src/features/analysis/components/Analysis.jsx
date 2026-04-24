import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Sparkles, Search, Download, AlertTriangle, Clock, AlertCircle,
  ChevronDown, ChevronUp, Eye, ShieldAlert, FileWarning, BookOpen, Bell,
} from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import { Input } from "../../../components/common/input";
import { Button } from "../../../components/common/button";
import { toast } from "sonner";
import { generateLegalPDF } from "../../../utils/generateLegalPDF";
import {
  selectAnalysisFindings,
  selectAiInsight,
  selectStatCards,
  selectAuditData,
  selectAuditStatus,
  selectExecutiveSummary,
} from "../../audit/state/audit.slice";
import { openAssistant } from "../../aiAssistant/chat.slice";

const severityStyles = {
  CRITICAL: "bg-rose-100 text-rose-700",
  HIGH:     "bg-orange-100 text-orange-700",
  MEDIUM:   "bg-slate-200 text-slate-700",
  LOW:      "bg-emerald-100 text-emerald-700",
};

const severityBorder = {
  CRITICAL: "border-l-rose-500",
  HIGH:     "border-l-orange-500",
  MEDIUM:   "border-l-slate-400",
  LOW:      "border-l-emerald-500",
};

function PatternGraph({ findings = [] }) {
  if (!findings || findings.length === 0) {
    return (
      <svg viewBox="0 0 300 200" className="h-[220px] w-full">
        <circle cx="150" cy="100" r="8" fill="#cbd5e1" opacity="0.5" />
        <text x="150" y="130" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">No findings detected</text>
      </svg>
    );
  }

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  findings.forEach(f => {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  });

  const severityColors = {
    CRITICAL: "#f43f5e", // rose-500
    HIGH:     "#f97316", // orange-500
    MEDIUM:   "#3b82f6", // blue-500
    LOW:      "#10b981", // emerald-500
  };

  const hub = { id: "hub", cx: 150, cy: 100, r: 12, color: "#3b82f6", opacity: 0.9 };
  const activeSeverities = Object.entries(counts).filter(([_, count]) => count > 0);
  
  const nodes = [hub];
  const edges = [];

  const rSeverities = 55;
  activeSeverities.forEach(([sev, count], index) => {
    // Distribute severity nodes evenly in a circle around the hub
    const angle = (index / activeSeverities.length) * Math.PI * 2 - Math.PI / 2;
    const cx = 150 + Math.cos(angle) * rSeverities;
    const cy = 100 + Math.sin(angle) * rSeverities;
    
    // Node radius depends on count of findings (min 10, max 24)
    const r = Math.min(24, 10 + count * 1.2);
    const sevNode = { id: sev, cx, cy, r, color: severityColors[sev], opacity: 0.95 };
    nodes.push(sevNode);
    edges.push({ source: hub, target: sevNode });

    // Attach finding "leaf" nodes to this severity node
    const maxLeaves = Math.min(count, 7); // cap leaf nodes for visual clarity
    for (let i = 0; i < maxLeaves; i++) {
       // Spread leaves in an arc pointing away from the hub
       const leafAngle = angle + ((i - (maxLeaves - 1) / 2) * 0.35); 
       const leafDist = r + 20 + ((i % 2) * 10); // alternate distance slightly for organic look
       const lcx = cx + Math.cos(leafAngle) * leafDist;
       const lcy = cy + Math.sin(leafAngle) * leafDist;
       const leafNode = { id: `${sev}-leaf-${i}`, cx: lcx, cy: lcy, r: 4, color: severityColors[sev], opacity: 0.6 };
       nodes.push(leafNode);
       edges.push({ source: sevNode, target: leafNode });
    }
  });

  // Calculate glow color based on the highest severity present
  const hasCritical = counts.CRITICAL > 0;
  const hasHigh = counts.HIGH > 0;
  const glowColor = hasCritical ? "#ffe4e6" : hasHigh ? "#ffedd5" : "#eff6ff"; // rose-50, orange-50, blue-50

  return (
    <svg viewBox="0 0 300 200" className="h-[220px] w-full">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={glowColor} stopOpacity="1" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="100" r="100" fill="url(#glow)" />
      
      {edges.map((e, i) => (
        <line key={`edge-${i}`} x1={e.source.cx} y1={e.source.cy} x2={e.target.cx} y2={e.target.cy}
          stroke="#cbd5e1" strokeWidth="1.5" opacity="0.5" />
      ))}
      
      {nodes.map((n, i) => (
        <circle key={`node-${i}`} cx={n.cx} cy={n.cy} r={n.r} fill={n.color} opacity={n.opacity}>
          <title>{n.id}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Expandable finding detail panel */
function FindingDetail({ finding }) {
  const [open, setOpen] = useState(false);
  const hasDetail = finding.what_it_is || finding.why_it_matters || finding.user_impact || finding.evidence_summary;

  return (
    <div className={`border-b border-slate-50 last:border-0 ${open ? "bg-slate-50/50" : ""}`}>
      <div
        className={`grid grid-cols-[130px_1fr_140px_220px_140px_40px] items-center gap-4 px-6 py-4 text-[13px] ${hasDetail ? "cursor-pointer hover:bg-slate-50/60" : ""}`}
        onClick={() => hasDetail && setOpen(!open)}
        data-testid={`finding-${finding.id}`}
      >
        <div className="font-mono text-[12.5px] font-semibold text-blue-600">{finding.id}</div>
        <div className="font-medium text-slate-800">{finding.entity}</div>
        <div>
          <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold ${severityStyles[finding.severity]}`}>
            {finding.severity}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className={`h-2 w-2 rounded-full ${finding.statusTone}`} />
          {finding.controlStatus}
        </div>
        <div className="text-slate-500">{finding.date}</div>
        <div className="flex justify-center">
          {hasDetail && (
            open
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {open && hasDetail && (
        <div className={`mx-6 mb-5 rounded-xl border-l-[3px] ${severityBorder[finding.severity]} bg-white p-5 shadow-sm`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {finding.what_it_is && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <Eye className="h-3.5 w-3.5" /> What Is This Pattern?
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {finding.what_it_is}
                </p>
              </div>
            )}

            {finding.why_it_matters && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <ShieldAlert className="h-3.5 w-3.5" /> Why It Matters
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {finding.why_it_matters}
                </p>
              </div>
            )}

            {finding.user_impact && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <AlertTriangle className="h-3.5 w-3.5" /> User Impact
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {finding.user_impact}
                </p>
              </div>
            )}

            {finding.evidence_summary && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <FileWarning className="h-3.5 w-3.5" /> Evidence
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {finding.evidence_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const findings      = useSelector(selectAnalysisFindings);
  const aiInsight     = useSelector(selectAiInsight);
  const statCards     = useSelector(selectStatCards);
  const auditData     = useSelector(selectAuditData);
  const auditStatus   = useSelector(selectAuditStatus);
  const execSummary   = useSelector(selectExecutiveSummary);
  const hasResults    = !!auditData;

  const filtered = findings.filter((f) =>
    (f.id + f.entity).toLowerCase().includes(query.toLowerCase())
  );

  const riskScore     = statCards?.risk_score     ?? 0;
  const criticalCount = statCards?.critical_count ?? 0;

  return (
    <AppLayout>
      <div id="analysis-report-content" className="relative h-full min-h-[calc(100vh-100px)] p-4 bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            Analysis Findings
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
            {auditStatus === "loading" ? "Scanning…" : hasResults ? "Live Results" : "Awaiting Audit"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Assistant Button */}
          <div className="flex rounded-lg bg-slate-100 p-1 mr-2">
            <button
              onClick={() => dispatch(openAssistant())}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all"
              title="Open AI Assistant Overlay"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open Assistant
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              data-testid="findings-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search finding ID..."
              className="h-10 w-[280px] rounded-lg border-slate-200 bg-white pl-9 text-sm"
            />
          </div>
          <Button
            data-testid="analysis-export-btn"
            disabled={!hasResults}
            onClick={() => generateLegalPDF(auditData, "Formal_Analysis_Report.pdf")}
            className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${
              hasResults
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
          >
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      {/* Empty prompt when no audit has run */}
      {!hasResults && (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center">
          <AlertCircle className="h-12 w-12 text-slate-400" />
          <div>
            <p className="text-[17px] font-bold text-slate-700">No analysis data yet</p>
            <p className="mt-1 text-[14px] text-slate-500">
              {auditStatus === "loading"
                ? "Audit is running, please wait…"
                : "Run an audit from the Config page to populate this view."}
            </p>
          </div>
          {auditStatus !== "loading" && (
            <Button
              onClick={() => navigate("/config")}
              className="mt-2 h-10 rounded-lg bg-blue-600 px-6 text-[13px] font-semibold"
            >
              Run Audit
            </Button>
          )}
        </div>
      )}

      {/* Main content — only shown when audit data exists */}
      {hasResults && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_360px]">
            {/* Pattern Graph */}
            <div data-testid="pattern-graph-card" className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-bold text-slate-900">Pattern Detection Graph</h3>
                  <p className="mt-1 max-w-[220px] text-[12.5px] text-slate-500">
                    Visualized clusters of regulatory deviations
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {statCards?.total_findings} Findings
                  </span>
                  <span className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {statCards?.total_elements_scanned} Elements
                  </span>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-gradient-to-br from-rose-50/50 to-slate-50 p-2">
                <PatternGraph findings={findings} />
              </div>
            </div>

            {/* Aggregate Risk + Critical */}
            <div className="flex flex-col gap-6">
              <div data-testid="aggregate-risk-card" className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Aggregate Risk Score
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[48px] font-extrabold leading-none text-rose-600">{riskScore}</span>
                  <span className="text-[14px] font-medium text-slate-500">/ 100</span>
                </div>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${riskScore}%` }} />
                </div>
                <div className="mt-3 text-[12.5px] text-slate-500">
                  Based on {statCards?.total_findings} findings across {statCards?.total_elements_scanned} elements
                </div>
              </div>

              <div data-testid="critical-findings-card" className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Critical Findings
                    </div>
                    <div className="mt-3 text-[40px] font-extrabold leading-none text-slate-900">
                      {criticalCount}
                    </div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-rose-100 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 text-[12.5px] text-slate-500">
                  {statCards?.high_count} high · {statCards?.medium_count} medium · {statCards?.low_count} low
                </div>
              </div>
            </div>

            {/* AI Insights — enhanced */}
            <aside data-testid="ai-insights-card" className="rounded-2xl border border-slate-200 bg-white p-6 h-[375px] overflow-y-auto">
              <div className="flex items-center gap-2 text-blue-600">
                <Sparkles className="h-[18px] w-[18px]" />
                <span className="text-[17px] font-bold text-slate-900">AI Insights</span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-rose-600">
                {aiInsight?.title ?? "No AI insight available"}
              </p>

              <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Threat Vector Detection
              </div>
              <blockquote className="mt-3 rounded-lg bg-slate-50 p-4 text-[12.5px] leading-relaxed text-slate-700">
                {aiInsight?.threat_vector ?? "No threat vector identified."}
              </blockquote>

              <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Risk Decomposition
              </div>
              <div className="mt-3 space-y-3 text-[13px]">
                {[
                  ["Exploitability",    aiInsight?.risk_decomposition?.exploitability    ?? 0, "bg-rose-500"],
                  ["Data Exposure",     aiInsight?.risk_decomposition?.data_exposure     ?? 0, "bg-orange-500"],
                  ["Compliance Impact", aiInsight?.risk_decomposition?.compliance_impact ?? 0, "bg-rose-600"],
                ].map(([label, level, color]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">{label}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`h-1.5 w-6 rounded-sm ${i < level ? color : "bg-slate-200"}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border-l-[3px] border-blue-600 bg-blue-50/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                  AI Recommendation
                </div>
                <div className="mt-2 text-[14px] font-bold text-slate-900">
                  {aiInsight?.recommendation_title ?? "—"}
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                  {aiInsight?.recommendation_body ?? ""}
                </p>
              </div>

              <Button
                data-testid="auto-remediation-btn"
                onClick={() => navigate("/roadmap")}
                className="mt-5 h-10 w-full rounded-lg bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-800"
              >
                View Remediation Plan
              </Button>

              <div className="mt-4 flex items-center gap-2 text-[11.5px] text-slate-400">
                <Clock className="h-3.5 w-3.5" /> Just now
              </div>
            </aside>
          </div>

          {/* ═══ AI DEEP DIVE NARRATIVE ═══ */}
          {aiInsight?.deep_dive && (
            <div
              data-testid="ai-deep-dive-narrative"
              className="mt-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white">
                  <BookOpen className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-slate-900">AI Deep Dive Analysis</h3>
                  <p className="text-[11px] text-slate-500">Comprehensive narrative of all dark patterns detected</p>
                </div>
              </div>
              <p className="text-[14px] leading-[1.8] text-slate-700">
                {aiInsight.deep_dive}
              </p>
            </div>
          )}

          {/* ═══ DETAILED AUDIT LOG — with expandable explanations ═══ */}
          <section id="detailed-audit-log-content" data-testid="detailed-log-card" className="mt-6 rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-6 py-5">
              <h3 className="text-[17px] font-bold text-slate-900">
                Detailed Audit Log
                <span className="ml-3 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {filtered.length} findings
                </span>
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-slate-500 hidden md:inline">
                  Click any finding to see AI explanation
                </span>
                <button
                  data-testid="log-download-btn"
                  onClick={() => generateLegalPDF(auditData, "Formal_Audit_Log.pdf")}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                  title="Download Audit Log PDF"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[130px_1fr_140px_220px_140px_40px] gap-4 border-y border-slate-100 bg-slate-50 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <div>Finding ID</div>
              <div>Entity</div>
              <div>Severity</div>
              <div>Control Status</div>
              <div>Detection Date</div>
              <div></div>
            </div>
            {filtered.map((f) => (
              <FindingDetail key={f.id} finding={f} />
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-[14px] text-slate-500">
                {query ? "No findings match your search." : "No findings for this audit."}
              </div>
            )}
          </section>
        </>
      )}
      </div>
    </AppLayout>
  );
}

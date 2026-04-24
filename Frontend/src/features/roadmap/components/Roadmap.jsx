import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Download, Plus, Ban, EyeOff, AlertCircle, Timer,
  Search, SlidersHorizontal, TrendingUp,
  ChevronDown, ChevronUp, ListChecks, Wrench, Scale, CheckCircle2,
} from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import { Button } from "../../../components/common/button";
import { Input } from "../../../components/common/input";
import { toast } from "sonner";
import { exportToPDF } from "../../../utils/pdfExport";
import {
  selectRemediationTasks,
  selectTimeline,
  selectAuditData,
  selectStatCards,
  selectComplianceFrameworks,
} from "../../audit/state/audit.slice";

const iconMap = {
  ban:       Ban,
  "eye-off": EyeOff,
  alert:     AlertCircle,
  timer:     Timer,
};

const priorityStyles = {
  CRITICAL: "bg-rose-100 text-rose-700",
  HIGH:     "bg-orange-100 text-orange-700",
  MEDIUM:   "bg-blue-100 text-blue-700",
  LOW:      "bg-slate-100 text-slate-600",
};

const priorityBorder = {
  CRITICAL: "border-l-rose-500",
  HIGH:     "border-l-orange-500",
  MEDIUM:   "border-l-blue-500",
  LOW:      "border-l-slate-400",
};

/** Parse "$450k/yr" → 450 */
function parsePenaltyK(str = "") {
  const m = str.match(/\$([\d,.]+)k/i);
  return m ? parseFloat(m[1].replace(",", "")) : 0;
}

function HealthFooter({ riskScore }) {
  const pct = riskScore != null ? Math.max(0, 100 - riskScore) : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Health Score
      </div>
      {pct != null ? (
        <>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[26px] font-extrabold text-slate-900">{pct}%</span>
            <span className="text-[12px] font-semibold text-rose-500">Risk: {riskScore}</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-slate-400">Run an audit to see score</p>
      )}
    </div>
  );
}

/** Expandable task detail panel */
function TaskDetailPanel({ task }) {
  const [open, setOpen] = useState(false);
  const Icon = iconMap[task.icon] ?? AlertCircle;
  const hasDetail = task.detailed_steps || task.business_rationale || task.fix_recommendation || task.acceptance_criterion;

  return (
    <div className={`border-t border-slate-100 ${open ? "bg-slate-50/30" : ""}`}>
      <div
        data-testid={`task-row-${task.id}`}
        className={`grid grid-cols-[1.6fr_120px_140px_160px_180px] items-center gap-4 px-6 py-5 ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={() => hasDetail && setOpen(!open)}
      >
        <div className="flex items-start gap-4">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${task.iconBg}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-[14.5px] font-bold text-slate-900">{task.title}</div>
            <p className="mt-1 max-w-[440px] text-[12.5px] leading-relaxed text-slate-500">
              {task.description}
            </p>
          </div>
        </div>
        <div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${priorityStyles[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        <div className="font-mono text-[13px] font-semibold text-rose-600">{task.penalty}</div>
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white ${task.assignee?.color ?? "bg-slate-300"}`}>
            {(task.assignee?.name ?? "?").split(" ").map((s) => s[0]).join("").slice(0, 2)}
          </span>
          <span className="text-[13px] text-slate-700">{task.assignee?.name ?? "Unassigned"}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {hasDetail && (
            <span className="text-slate-400">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {open && hasDetail && (
        <div className={`mx-6 mb-5 rounded-xl border-l-[3px] ${priorityBorder[task.priority]} bg-white p-5 shadow-sm`}>
          {/* Business Rationale */}
          {task.business_rationale && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                <Scale className="h-3.5 w-3.5" /> Why This Matters
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">
                {task.business_rationale}
              </p>
            </div>
          )}

          {/* Fix Recommendation */}
          {task.fix_recommendation && (
            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 mb-1.5">
                <Wrench className="h-3.5 w-3.5" /> Recommended Fix
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">
                {task.fix_recommendation}
              </p>
            </div>
          )}

          {/* Implementation Steps */}
          {task.detailed_steps && task.detailed_steps.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                <ListChecks className="h-3.5 w-3.5" /> Implementation Steps
              </div>
              <div className="space-y-2">
                {task.detailed_steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[12.5px] leading-relaxed text-slate-700">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acceptance Criterion + Regulations */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {task.acceptance_criterion && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Acceptance Criterion
                </div>
                <p className="text-[12.5px] text-emerald-800">
                  {task.acceptance_criterion}
                </p>
              </div>
            )}

            {task.regulations_violated && task.regulations_violated.length > 0 && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 mb-1">
                  Regulations Violated
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {task.regulations_violated.map((reg, i) => (
                    <span key={i} className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      {reg}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Effort estimate */}
          {task.effort_estimate && (
            <div className="mt-3 text-[11px] text-slate-500">
              Estimated effort: <span className="font-semibold text-slate-700">
                {task.effort_estimate === "S" ? "Small (1-2 days)" : task.effort_estimate === "M" ? "Medium (3-5 days)" : "Large (1-2 weeks)"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Roadmap() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [resolved, setResolved] = useState(new Set());

  const tasks       = useSelector(selectRemediationTasks);
  const timeline    = useSelector(selectTimeline);
  const auditData   = useSelector(selectAuditData);
  const statCards   = useSelector(selectStatCards);
  const frameworks  = useSelector(selectComplianceFrameworks);
  const hasResults  = !!auditData;

  const filters = [
    { id: "all",      label: "All Tasks"    },
    { id: "high",     label: "High Priority" },
    { id: "penalty",  label: "Risk Penalty" },
    { id: "assigned", label: "Assigned"     },
  ];

  const visible = tasks.filter((t) => {
    if (resolved.has(t.id)) return false;
    if (filter === "high"     && !["CRITICAL", "HIGH"].includes(t.priority)) return false;
    if (filter === "assigned" && t.assignee?.name === "Unassigned") return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const maxVal = Math.max(...timeline.map((m) => Math.max(m.resolved || 0, m.projected || 0)), 1);
  const criticalCount = tasks.filter((t) => t.priority === "CRITICAL").length;

  // Compute total penalty from real task data
  const totalPenaltyK = tasks.reduce((s, t) => s + parsePenaltyK(t.penalty), 0);
  const penaltyLabel  = totalPenaltyK >= 1000
    ? `$${(totalPenaltyK / 1000).toFixed(1)}M`
    : `$${totalPenaltyK}k`;

  // GDPR score from compliance frameworks
  const gdprScore = frameworks.find((f) => f.id === "gdpr")?.score ?? null;

  // Completion based on resolved count vs total
  const completionPct = tasks.length > 0
    ? Math.round((resolved.size / tasks.length) * 100)
    : 0;

  return (
    <AppLayout sidebarFooter={<HealthFooter riskScore={statCards?.risk_score} />}>
      <div id="roadmap-report-content" className="relative h-full min-h-[calc(100vh-100px)] p-4 bg-[#FAFAFA]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900">
            Remediation Roadmap
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Surgical corrections for identified dark patterns and deceptive UI elements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            data-testid="roadmap-export-btn"
            variant={hasResults ? "default" : "outline"}
            disabled={!hasResults}
            onClick={() => exportToPDF("roadmap-report-content", "Roadmap_Report.pdf")}
            className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${
              hasResults
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
          >
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
          <Button
            data-testid="create-audit-task-btn"
            onClick={() => navigate("/config")}
            className="h-10 rounded-lg bg-blue-600 text-[13px] font-semibold hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Audit Task
          </Button>
        </div>
      </div>

      {/* Stat Row */}
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Risks</div>
          <div className="mt-3 text-[40px] font-extrabold leading-none text-slate-900">
            {hasResults ? tasks.length - resolved.size : "—"}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600">
            <span>⚠</span>{" "}
            {hasResults
              ? `${criticalCount} Critical Fix${criticalCount !== 1 ? "es" : ""} Required`
              : "No audit run yet"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Penalty</div>
          <div className="mt-3 text-[40px] font-extrabold leading-none text-rose-600">
            {hasResults ? penaltyLabel : "—"}
          </div>
          <div className="mt-3 text-[12.5px] text-slate-500">Estimated Regulatory Exposure</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completion</div>
          <div className="mt-3 text-[40px] font-extrabold leading-none text-slate-900">
            {hasResults ? `${completionPct}%` : "—"}
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tasks Resolved</div>
          <div className="mt-3 text-[40px] font-extrabold leading-none text-slate-900">
            {resolved.size}
          </div>
          <div className="mt-3 text-[12.5px] text-slate-500">
            of {tasks.length} total tasks
          </div>
        </div>
      </div>

      {/* Empty state when no audit */}
      {!hasResults && (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-slate-400" />
          <div>
            <p className="text-[17px] font-bold text-slate-700">No remediation tasks yet</p>
            <p className="mt-1 text-[14px] text-slate-500">Run an audit to generate your remediation roadmap.</p>
          </div>
          <Button
            onClick={() => navigate("/config")}
            className="mt-2 h-10 rounded-lg bg-blue-600 px-6 text-[13px] font-semibold"
          >
            Run Audit
          </Button>
        </div>
      )}

      {/* Task section — visible only when we have data */}
      {hasResults && (
        <>
          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 pl-3 pr-1 text-[13px] text-slate-500">
              <SlidersHorizontal className="h-[16px] w-[16px]" /> Filter By:
            </div>
            <div className="h-6 w-px bg-slate-200" />
            {filters.map((f) => (
              <button
                key={f.id}
                data-testid={`filter-${f.id}`}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  filter === f.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  data-testid="tasks-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="h-9 w-[260px] rounded-lg border-slate-200 bg-white pl-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-[12px] text-blue-700">
            <ListChecks className="h-4 w-4 shrink-0" />
            Click any task to expand detailed AI-generated fix steps, business rationale, and acceptance criteria.
          </div>

          {/* Task List — expandable */}
          <section data-testid="tasks-card" className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1.6fr_120px_140px_160px_180px] gap-4 bg-slate-50 px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <div>Task / Dark Pattern Fix</div>
              <div>Priority</div>
              <div>Risk Penalty</div>
              <div>Assigned To</div>
              <div className="text-right">Details</div>
            </div>

            {visible.length === 0 && (
              <div className="p-10 text-center text-[14px] text-slate-500">
                All clear. No matching remediation tasks.
              </div>
            )}

            {visible.map((t) => (
              <TaskDetailPanel key={t.id} task={t} />
            ))}

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 text-[13px] text-slate-500">
              <span>Showing {visible.length} of {tasks.length} items</span>
              <div className="flex items-center gap-1.5">
                <button className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-white">‹</button>
                <button className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-white">›</button>
              </div>
            </div>
          </section>

          {/* Timeline + Risk Reduction */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div data-testid="timeline-card" className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-slate-900">Remediation Timeline</h3>
                <div className="flex items-center gap-4 text-[12px] text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Resolved
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Projected
                  </span>
                </div>
              </div>

              {timeline.length === 0 ? (
                <p className="mt-6 text-center text-[13px] text-slate-400">No timeline data available.</p>
              ) : (
                <div className="mt-8 flex h-[200px] items-end gap-6 px-2">
                  {timeline.map((m) => {
                    const val = (m.resolved || 0) + (m.projected || 0);
                    const h   = (val / maxVal) * 100;
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-3">
                        <div className="flex h-full w-full items-end justify-center">
                          <div
                            style={{ height: `${Math.max(h, 4)}%` }}
                            className={`w-full max-w-[52px] rounded-t-md transition-all ${
                              m.resolved > 0 ? "bg-blue-600" : "bg-slate-200"
                            }`}
                          />
                        </div>
                        <span className="text-[11px] font-semibold tracking-wider text-slate-400">
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center gap-2 text-[13px] text-blue-100">
                <TrendingUp className="h-4 w-4" /> Risk Reduction
              </div>
              <p className="mt-3 text-[14px] leading-relaxed">
                Completing the {criticalCount} critical task{criticalCount !== 1 ? "s" : ""} will
                significantly reduce your total regulatory risk exposure.
              </p>
              {gdprScore != null && (
                <div className="mt-6 rounded-xl bg-blue-800/40 p-4 ring-1 ring-white/20">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100">
                    GDPR Compliance Score
                  </div>
                  <div className="mt-1 text-[26px] font-extrabold">{gdprScore} / 100</div>
                </div>
              )}
              <Button
                data-testid="impact-analysis-btn"
                onClick={() => navigate("/analysis")}
                className="mt-5 h-10 w-full rounded-lg bg-white text-[13px] font-semibold text-blue-700 hover:bg-slate-100"
              >
                View Impact Analysis
              </Button>
            </div>
          </div>
        </>
      )}
      </div>
    </AppLayout>
  );
}

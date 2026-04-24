import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { generateHistoryPDF } from "../../../utils/generateHistoryPDF";
import { Download, Plus, Search, Loader2, RefreshCw } from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import { Input } from "../../../components/common/input";
import { Button } from "../../../components/common/button";
import {
  fetchAuditHistory,
  loadAuditById,
  selectHistory,
  selectHistoryStatus,
} from "../../audit/state/audit.slice";

const statusStyles = {
  Completed: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Draft: "bg-slate-200 text-slate-600",
};

export default function Audits() {
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const history    = useSelector(selectHistory);
  const status     = useSelector(selectHistoryStatus);
  const [q, setQ]  = useState("");

  // Load history on mount
  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchAuditHistory());
    }
  }, [dispatch, status]);

  const rows = history.filter((a) =>
    (String(a.id) + a.target + a.framework).toLowerCase().includes(q.toLowerCase())
  );

  const handleRowClick = async (id) => {
    toast.loading("Loading audit results…", { id: "load-audit" });
    const action = await dispatch(loadAuditById(id));
    if (loadAuditById.fulfilled.match(action)) {
      toast.success("Audit loaded", { id: "load-audit" });
      navigate("/dashboard");
    } else {
      toast.error("Failed to load audit", { id: "load-audit" });
    }
  };

  return (
    <AppLayout>
      <div id="audits-table-content" className="relative h-full min-h-[calc(100vh-100px)] p-4 bg-[#FAFAFA]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900">
            All Audits
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Complete history of audit runs across all targets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={rows.length > 0 ? "default" : "outline"}
            onClick={() => generateHistoryPDF(rows, "Audit_History.pdf")}
            disabled={rows.length === 0}
            className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${
              rows.length > 0
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
          >
            <Download className="mr-2 h-4 w-4" /> Export History
          </Button>
          <Button
            variant="outline"
            onClick={() => dispatch(fetchAuditHistory())}
            className="h-10 rounded-lg border-slate-200 bg-white text-[13px] font-semibold text-slate-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button
            data-testid="audits-new-btn"
            onClick={() => navigate("/config")}
            className="h-10 rounded-lg bg-blue-600 text-[13px] font-semibold hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" /> New Audit
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid="audits-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by target or framework..."
            className="h-10 w-full border-0 pl-9 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[180px_1.6fr_1.2fr_140px_110px_110px_120px] gap-4 bg-slate-50 px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <div>Audit ID</div>
          <div>Target</div>
          <div>Framework</div>
          <div>Status</div>
          <div>Findings</div>
          <div>Risk</div>
          <div className="text-right">Date</div>
        </div>

        {/* Loading state */}
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-14 text-[14px] text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading audit history…
          </div>
        )}

        {/* Empty state */}
        {status === "succeeded" && rows.length === 0 && (
          <div className="py-14 text-center text-[14px] text-slate-500">
            {q
              ? "No audits match your search."
              : "No audits yet — run your first audit to see results here."}
          </div>
        )}

        {/* Rows */}
        {rows.map((a) => (
          <div
            key={String(a.id)}
            data-testid={`audit-${a.id}`}
            onClick={() => handleRowClick(a.id)}
            className="grid cursor-pointer grid-cols-[180px_1.6fr_1.2fr_140px_110px_110px_120px] items-center gap-4 border-t border-slate-100 px-6 py-4 text-[13px] transition hover:bg-slate-50"
          >
            <div className="font-mono text-[12px] text-blue-600 truncate">
              {String(a.id).slice(-12).toUpperCase()}
            </div>
            <div className="font-medium text-slate-900 truncate">{a.target}</div>
            <div className="text-slate-600 truncate">{a.framework}</div>
            <div>
              <span
                className={`inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles[a.status] ?? "bg-slate-100 text-slate-600"}`}
              >
                {a.status}
              </span>
            </div>
            <div className="text-slate-700">{a.findings}</div>
            <div
              className={`font-mono font-bold ${
                a.risk > 60
                  ? "text-rose-600"
                  : a.risk > 30
                    ? "text-orange-600"
                    : "text-emerald-600"
              }`}
            >
              {a.risk || "—"}
            </div>
            <div className="text-right text-slate-500">{a.date}</div>
          </div>
        ))}
      </section>
      </div>
    </AppLayout>
  );
}

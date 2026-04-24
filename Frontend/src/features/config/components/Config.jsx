import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Info, Plus, ShieldCheck, Scale, ListChecks, Shield, Loader2 } from "lucide-react";
import AppLayout from "../../../components/layout/AppLayout/AppLayout";
import { Button } from "../../../components/common/button";
import { Input } from "../../../components/common/input";
import { Checkbox } from "../../../components/common/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/common/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/common/tabs";
import { toast } from "sonner";
// Static list of supported compliance frameworks (UI config, not audit data)
const FRAMEWORKS = [
  { id: "eu-ai-act", name: "EU AI Act",      desc: "High-risk system categorization and transparency requirements.",              icon: "shield",        defaultSelected: true  },
  { id: "dpdp",     name: "DPDP (India)",   desc: "Digital Personal Data Protection compliance for data principals.",          icon: "scale",         defaultSelected: true },
  { id: "gdpr",     name: "GDPR",           desc: "European data privacy and security law standards.",                         icon: "shield-check",  defaultSelected: true  },
  { id: "nist",     name: "NIST AI RMF",    desc: "Risk management framework for trustworthy artificial intelligence.",        icon: "list-checks",   defaultSelected: true },
];
import { runAudit, selectAuditStatus } from "../../audit/state/audit.slice";

const iconMap = {
  shield: Shield,
  scale: Scale,
  "shield-check": ShieldCheck,
  "list-checks": ListChecks,
};

function CapacityFooter() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Audit Capacity
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-[75%] rounded-full bg-blue-600" />
      </div>
      <div className="mt-2 text-[12px] text-slate-500">18/24 Active Threads</div>
    </div>
  );
}

export default function Config() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const auditStatus = useSelector(selectAuditStatus);
  const isLoading = auditStatus === "loading";

  const [selected, setSelected] = useState(
    new Set(FRAMEWORKS.map((f) => f.id))
  );
  const [source, setSource] = useState("url");
  const [url, setUrl] = useState("");

  const toggleFw = (id) => {
    // Disabled: User cannot deselect frameworks.
  };

  const startAudit = async () => {
    // ── Validation ──────────────────────────────────────────────────────
    const trimmedUrl = url.trim();
    if (source === "url" && !trimmedUrl) {
      toast.error("Please provide a target URL");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one regulatory framework");
      return;
    }

    // Build a full URL if the user omitted the protocol
    const fullUrl = trimmedUrl.startsWith("http")
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    toast.loading("Crawling and analysing — this may take 30–60 seconds…", {
      id: "audit-toast",
    });

    try {
      const resultAction = await dispatch(runAudit(fullUrl));

      if (runAudit.fulfilled.match(resultAction)) {
        toast.success("Audit complete! Navigating to dashboard…", {
          id: "audit-toast",
        });
        navigate("/dashboard");
      } else {
        const errMsg =
          typeof resultAction.payload === "string"
            ? resultAction.payload
            : resultAction.payload?.message || "Audit failed — check the console for details";
        toast.error(errMsg, { id: "audit-toast" });
      }
    } catch (err) {
      toast.error("Unexpected error during audit", { id: "audit-toast" });
      console.error("[Config] startAudit error:", err);
    }
  };

  return (
    <AppLayout sidebarFooter={<CapacityFooter />}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Audits <ChevronRight className="h-3 w-3" />
            <span className="text-blue-600">Start New Audit</span>
          </div>
          <h1 className="mt-2 text-[32px] font-extrabold tracking-tight text-slate-900">
            New Configuration
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Establish the scope, source data, and regulatory frameworks for your
            next compliance audit.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Data Source */}
          <section
            data-testid="data-source-card"
            className="rounded-2xl border border-slate-200 bg-white p-7"
          >
            <h2 className="text-[20px] font-bold text-slate-900">
              1. Data Source
            </h2>

            <Tabs value={source} onValueChange={setSource} className="mt-5">
              <TabsList className="h-auto w-full justify-start gap-8 rounded-none border-b border-slate-200 bg-transparent p-0">
                <TabsTrigger
                  data-testid="tab-target-url"
                  value="url"
                  className="relative rounded-none border-0 bg-transparent pb-3 text-[14px] font-semibold text-slate-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  Target URL
                  {source === "url" && (
                    <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-blue-600" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  data-testid="tab-file-upload"
                  value="file"
                  className="relative rounded-none border-0 bg-transparent pb-3 text-[14px] font-semibold text-slate-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  Direct File Upload
                  {source === "file" && (
                    <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-blue-600" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  data-testid="tab-api"
                  value="api"
                  className="relative rounded-none border-0 bg-transparent pb-3 text-[14px] font-semibold text-slate-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  API Integration
                  {source === "api" && (
                    <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-blue-600" />
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6">
              <label className="text-[13px] font-semibold text-slate-700">
                Application Root URL
              </label>
              <div className="mt-2 flex h-11 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <span className="grid w-24 place-items-center bg-slate-50 text-[13px] font-mono text-slate-500">
                  https://
                </span>
                <input
                  data-testid="url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  className="flex-1 bg-white px-3 text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
                  disabled={isLoading}
                />
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-[13px] text-blue-700">
                <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-blue-600" />
                <p className="leading-relaxed">
                  Providing a direct URL allows YourCrawl to perform live dark
                  pattern detection. The full crawl + AI analysis typically takes
                  30–60 seconds.
                </p>
              </div>
            </div>
          </section>

          {/* Run Audit Button */}
          <div className="flex justify-end pt-4">
            <Button
              data-testid="run-audit-btn"
              onClick={startAudit}
              disabled={isLoading}
              className="h-12 w-full md:w-auto rounded-xl bg-blue-600 px-10 text-[15px] font-bold shadow-sm hover:bg-blue-700 hover:shadow-md disabled:opacity-60 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Running Audit…
                </>
              ) : (
                "Run Audit Now"
              )}
            </Button>
          </div>
        </div>

        {/* Frameworks */}
        <section
          data-testid="frameworks-card"
          className="rounded-2xl border border-slate-200 bg-white p-7"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold text-slate-900">
              2. Frameworks
            </h2>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              {selected.size} Selected
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {FRAMEWORKS.map((fw) => {
              const Icon = iconMap[fw.icon] ?? Shield;
              const active = true; // Always active since they cannot be deselected
              return (
                <div
                  key={fw.id}
                  data-testid={`fw-${fw.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border p-5 text-left transition border-blue-500 bg-blue-50/30 ring-1 ring-blue-500"
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-slate-900">
                        {fw.name}
                      </div>
                      <p className="mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-slate-500">
                        {fw.desc}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition border-blue-600 bg-blue-600 text-white cursor-not-allowed opacity-80">
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-white" strokeWidth="2">
                      <path d="M2 6.5 L5 9 L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            data-testid="add-rubric-btn"
            onClick={() => toast("Custom rubric builder coming soon")}
            disabled={isLoading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-[12px] font-semibold uppercase tracking-wider text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
          >
            <Plus className="h-[14px] w-[14px]" /> Add Custom Rubric
          </button>
        </section>
      </div>
    </AppLayout>
  );
}

// Mock data for Aegis Auditor - Institutional Compliance platform

export const recentAuditTrail = [
  {
    id: "AC-01-2024",
    action: "Identity Provider Access Review",
    assessor: { name: "Jane Doe", initials: "JD", color: "bg-blue-100 text-blue-700" },
    status: "PASS",
    date: "2h ago",
  },
  {
    id: "SC-05-2024",
    action: "Network Encryption Validation",
    assessor: { name: "Marcus Kane", initials: "MK", color: "bg-rose-100 text-rose-700" },
    status: "REVIEW",
    date: "5h ago",
  },
  {
    id: "IA-12-2024",
    action: "Multi-Factor Auth Enforcement",
    assessor: { name: "Sarah Lee", initials: "SL", color: "bg-indigo-100 text-indigo-700" },
    status: "PASS",
    date: "Yesterday",
  },
  {
    id: "CM-04-2024",
    action: "Production Patch Window",
    assessor: { name: "System", initials: "SYS", color: "bg-slate-200 text-slate-700" },
    status: "FAIL",
    date: "Oct 24",
  },
];

export const systemIntegrity = [
  { name: "Compliance Core", status: "Healthy", tone: "ok" },
  { name: "Data Storage", status: "Healthy", tone: "ok" },
  { name: "API Gateway", status: "Degraded", tone: "warn" },
];

export const frameworks = [
  {
    id: "eu-ai-act",
    name: "EU AI Act",
    desc: "High-risk system categorization and transparency requirements.",
    icon: "shield",
    defaultSelected: true,
  },
  {
    id: "dpdp",
    name: "DPDP (India)",
    desc: "Digital Personal Data Protection compliance for data principals.",
    icon: "scale",
    defaultSelected: false,
  },
  {
    id: "gdpr",
    name: "GDPR",
    desc: "European data privacy and security law standards.",
    icon: "shield-check",
    defaultSelected: true,
  },
  {
    id: "nist",
    name: "NIST AI RMF",
    desc: "Risk management framework for trustworthy artificial intelligence.",
    icon: "list-checks",
    defaultSelected: false,
  },
];

export const remediationTasks = [
  {
    id: 1,
    title: "Roach Motel Subscription",
    description:
      'The "Cancel Subscription" button is hidden behind four sub-menus and requires a phone call. Redesign with one-click parity.',
    priority: "CRITICAL",
    penalty: "$450k/yr",
    assignee: { name: "Sarah Chen", color: "bg-teal-600" },
    icon: "ban",
    iconBg: "bg-rose-100 text-rose-600",
  },
  {
    id: 2,
    title: "Pre-selected Marketing Add-ons",
    description:
      "Checkout page defaults to 'Standard Insurance' opt-in. Violates CCPA opt-in requirements.",
    priority: "HIGH",
    penalty: "$280k/yr",
    assignee: { name: "Marc J.", color: "bg-emerald-500" },
    icon: "eye-off",
    iconBg: "bg-orange-100 text-orange-600",
  },
  {
    id: 3,
    title: "Confirmshaming Modal Text",
    description:
      '"No thanks, I prefer to pay full price" dismissal button. Update to neutral "Not at this time".',
    priority: "MEDIUM",
    penalty: "$85k/yr",
    assignee: { name: "Unassigned", color: "bg-slate-300" },
    icon: "alert",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    id: 4,
    title: "Artificial Scarcity Timer",
    description:
      '"Offer expires in 04:59" timer resets on refresh. Remove deceptive urgency cues from landing page.',
    priority: "LOW",
    penalty: "$12k/yr",
    assignee: { name: "Kevin L.", color: "bg-slate-800" },
    icon: "timer",
    iconBg: "bg-slate-100 text-slate-700",
  },
];

export const remediationTimeline = [
  { month: "JAN", resolved: 1, projected: 0 },
  { month: "FEB", resolved: 2, projected: 0 },
  { month: "MAR", resolved: 3, projected: 0 },
  { month: "APR", resolved: 4, projected: 0 },
  { month: "MAY", resolved: 4, projected: 0 },
  { month: "JUN", resolved: 0, projected: 5 },
  { month: "JUL", resolved: 0, projected: 6 },
  { month: "AUG", resolved: 0, projected: 7 },
];

export const analysisFindings = [
  {
    id: "AF-2024-001",
    entity: "AWS IAM Policy #401",
    severity: "CRITICAL",
    controlStatus: "Non-Compliant",
    statusTone: "bg-rose-500",
    date: "Oct 12, 2024",
  },
  {
    id: "AF-2024-002",
    entity: "Encryption at Rest",
    severity: "HIGH",
    controlStatus: "Partial Compliance",
    statusTone: "bg-orange-500",
    date: "Oct 12, 2024",
  },
  {
    id: "AF-2024-003",
    entity: "Log Retention Policy",
    severity: "MEDIUM",
    controlStatus: "Review Required",
    statusTone: "bg-slate-400",
    date: "Oct 11, 2024",
  },
  {
    id: "AF-2024-004",
    entity: "TLS 1.2 Endpoint Scan",
    severity: "LOW",
    controlStatus: "Compliant",
    statusTone: "bg-emerald-500",
    date: "Oct 10, 2024",
  },
];

export const complianceFrameworks = [
  { id: "gdpr", name: "GDPR", score: 88, controls: 42, passed: 37, icon: "shield-check" },
  { id: "ccpa", name: "CCPA", score: 74, controls: 28, passed: 20, icon: "scale" },
  { id: "soc2", name: "SOC 2 Type II", score: 92, controls: 64, passed: 59, icon: "lock" },
  { id: "iso", name: "ISO 27001", score: 81, controls: 114, passed: 93, icon: "file-check" },
  { id: "eu-ai", name: "EU AI Act", score: 66, controls: 38, passed: 25, icon: "cpu" },
  { id: "nist", name: "NIST AI RMF", score: 70, controls: 24, passed: 17, icon: "list-checks" },
];

export const auditsList = [
  {
    id: "AUD-20241024",
    target: "checkout.aegis-demo.com",
    framework: "GDPR · EU AI Act",
    status: "Completed",
    findings: 14,
    risk: 78,
    date: "Oct 24, 2024",
  },
  {
    id: "AUD-20241018",
    target: "portal.aegis-demo.com",
    framework: "SOC 2 Type II",
    status: "In Progress",
    findings: 6,
    risk: 42,
    date: "Oct 18, 2024",
  },
  {
    id: "AUD-20241009",
    target: "api.aegis-demo.com",
    framework: "NIST AI RMF",
    status: "Completed",
    findings: 3,
    risk: 21,
    date: "Oct 9, 2024",
  },
  {
    id: "AUD-20240928",
    target: "app.aegis-demo.com",
    framework: "GDPR · DPDP",
    status: "Draft",
    findings: 0,
    risk: 0,
    date: "Sep 28, 2024",
  },
];

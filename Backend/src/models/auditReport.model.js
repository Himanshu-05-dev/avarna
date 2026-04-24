import mongoose from "mongoose";

/**
 * AuditReport
 *
 * Persists the full structured JSON produced by the AI audit pipeline
 * for every crawl a user runs. This powers the audit history list and
 * lets users revisit past results without re-crawling.
 */
const auditReportSchema = new mongoose.Schema(
  {
    // The user who triggered the crawl
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The URL that was audited
    scanUrl: {
      type: String,
      required: true,
    },

    // The full AI-generated audit payload (stored as Mixed so we can
    // store any shape Gemini returns without maintaining a rigid sub-schema)
    auditData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Denormalised summary fields for fast list queries (avoids loading
    // the full auditData just to render the Audits table)
    summary: {
      totalFindings: { type: Number, default: 0 },
      riskScore:     { type: Number, default: 0 },
      criticalCount: { type: Number, default: 0 },
      highCount:     { type: Number, default: 0 },
      mediumCount:   { type: Number, default: 0 },
      lowCount:      { type: Number, default: 0 },
      framework:     { type: String, default: "" }, // e.g. "GDPR · DPDP"
    },
  },
  {
    timestamps: true, // createdAt = when the audit was run
  }
);

const AuditReport = mongoose.model("AuditReport", auditReportSchema);
export default AuditReport;

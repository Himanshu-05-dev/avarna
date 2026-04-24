import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Styles
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.6,
    color: "#334155",
  },
  headerContainer: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a8a",
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  subtitleBox: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 4,
    width: "48%",
  },
  subtitleLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  subtitleValue: {
    fontSize: 11,
    color: "#0f172a",
    fontFamily: "Helvetica-Bold",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
    paddingLeft: 8,
    paddingVertical: 2,
  },
  text: {
    marginBottom: 8,
    textAlign: "justify",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 10,
    alignItems: "flex-start",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  col1: { width: "18%", paddingRight: 10, paddingLeft: 6 },
  col2: { width: "25%", paddingRight: 10 },
  col3: { width: "57%", paddingRight: 6 },
  tableHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#f8fafc",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeCritical: { color: "#e11d48", fontFamily: "Helvetica-Bold", fontSize: 9 },
  badgeHigh: { color: "#ea580c", fontFamily: "Helvetica-Bold", fontSize: 9 },
  badgeMedium: { color: "#2563eb", fontFamily: "Helvetica-Bold", fontSize: 9 },
  badgeLow: { color: "#16a34a", fontFamily: "Helvetica-Bold", fontSize: 9 },
  insightBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 14,
    borderRadius: 6,
    marginBottom: 16,
  },
  insightTitle: {
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    marginBottom: 6,
    fontSize: 12,
  },
  frameworkBox: {
    marginBottom: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 9,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#94a3b8",
  },
});

const getSeverityStyle = (severity) => {
  if (severity === "CRITICAL") return styles.badgeCritical;
  if (severity === "HIGH") return styles.badgeHigh;
  if (severity === "MEDIUM") return styles.badgeMedium;
  return styles.badgeLow;
};

export const LegalReportDocument = ({ data }) => {
  if (!data) return <Document><Page size="A4"><Text>No Data Available</Text></Page></Document>;

  const {
    audit_entry,
    executive_summary,
    stat_cards,
    ai_insight,
    analysis_findings = [],
    remediation_tasks = [],
    compliance_frameworks = [],
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Formal Analysis Report</Text>
          <View style={styles.subtitleRow}>
            <View style={styles.subtitleBox}>
              <Text style={styles.subtitleLabel}>Target Audited</Text>
              <Text style={styles.subtitleValue}>{audit_entry?.target || "N/A"}</Text>
            </View>
            <View style={styles.subtitleBox}>
              <Text style={styles.subtitleLabel}>Audit Date</Text>
              <Text style={styles.subtitleValue}>{audit_entry?.date || "N/A"}</Text>
            </View>
          </View>
          <View style={[styles.subtitleRow, { marginTop: 4 }]}>
            <View style={styles.subtitleBox}>
              <Text style={styles.subtitleLabel}>Overall Risk Score</Text>
              <Text style={[styles.subtitleValue, { color: stat_cards?.risk_score > 50 ? "#e11d48" : "#16a34a" }]}>
                {stat_cards?.risk_score || 0} / 100
              </Text>
            </View>
            <View style={styles.subtitleBox}>
              <Text style={styles.subtitleLabel}>Total Findings Detected</Text>
              <Text style={styles.subtitleValue}>{stat_cards?.total_findings || 0} Findings</Text>
            </View>
          </View>
        </View>

        {/* EXECUTIVE SUMMARY */}
        {executive_summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.text}>{executive_summary}</Text>
          </View>
        )}

        {/* AI INSIGHT */}
        {ai_insight && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Deep Dive Analysis</Text>
            <View style={styles.insightBox}>
              <Text style={styles.insightTitle}>{ai_insight.title}</Text>
              <Text style={styles.text}>{ai_insight.threat_vector}</Text>
              <Text style={styles.text}><Text style={styles.bold}>Recommendation: </Text>{ai_insight.recommendation_body}</Text>
            </View>
            {ai_insight.deep_dive && <Text style={styles.text}>{ai_insight.deep_dive}</Text>}
          </View>
        )}

        {/* DETAILED FINDINGS TABLE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Analysis Findings</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.col1, styles.tableHeader]}>Severity</Text>
            <Text style={[styles.col2, styles.tableHeader]}>Entity / Element</Text>
            <Text style={[styles.col3, styles.tableHeader]}>Detailed AI Analysis</Text>
          </View>

          {/* Table Rows */}
          {analysis_findings.map((f, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={styles.col1}>
                <Text style={getSeverityStyle(f.severity)}>{f.severity}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.bold}>{f.entity}</Text>
                <Text style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>ID: {f.id}</Text>
              </View>
              <View style={styles.col3}>
                {f.what_it_is && <Text style={styles.text}><Text style={styles.bold}>Pattern: </Text>{f.what_it_is}</Text>}
                {f.why_it_matters && <Text style={styles.text}><Text style={styles.bold}>Impact: </Text>{f.why_it_matters}</Text>}
                {f.evidence_summary && <Text style={styles.text}><Text style={styles.bold}>Evidence: </Text>{f.evidence_summary}</Text>}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        
        {/* REMEDIATION TASKS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remediation Roadmap</Text>
          
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.col1, styles.tableHeader]}>Priority</Text>
            <Text style={[styles.col2, styles.tableHeader]}>Task</Text>
            <Text style={[styles.col3, styles.tableHeader]}>Remediation Details</Text>
          </View>

          {remediation_tasks.map((t, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={styles.col1}>
                <Text style={getSeverityStyle(t.priority)}>{t.priority}</Text>
                <Text style={{ fontSize: 8, marginTop: 4 }}>Penalty: {t.penalty}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.bold}>{t.title}</Text>
                <Text style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>Effort: {t.effort_estimate}</Text>
              </View>
              <View style={styles.col3}>
                {t.business_rationale && <Text style={styles.text}><Text style={styles.bold}>Rationale: </Text>{t.business_rationale}</Text>}
                {t.fix_recommendation && <Text style={styles.text}><Text style={styles.bold}>Fix: </Text>{t.fix_recommendation}</Text>}
                {t.detailed_steps && t.detailed_steps.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.bold}>Steps:</Text>
                    {t.detailed_steps.map((step, idx) => (
                      <Text key={idx} style={{ fontSize: 9, marginBottom: 2 }}>• {step}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* COMPLIANCE FRAMEWORKS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance Posture</Text>
          {compliance_frameworks.map((fw, i) => (
            <View key={i} style={styles.frameworkBox} wrap={false}>
              <Text style={[styles.bold, { fontSize: 13, marginBottom: 4, color: "#1e3a8a" }]}>{fw.name} — Score: {fw.score}/100</Text>
              <Text style={{ fontSize: 9, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Passed {fw.passed} out of {fw.controls} controls</Text>
              {fw.explanation && <Text style={[styles.text, { marginBottom: 0 }]}>{fw.explanation}</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>
    </Document>
  );
};

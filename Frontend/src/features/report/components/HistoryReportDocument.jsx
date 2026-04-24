import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
    marginBottom: 20,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },

  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#f8fafc",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colID: { width: "20%", paddingRight: 6 },
  colTarget: { width: "25%", paddingRight: 6 },
  colFW: { width: "20%", paddingRight: 6 },
  colStats: { width: "15%", paddingRight: 6 },
  colDate: { width: "20%", textAlign: "right" },
  text: {
    fontSize: 9,
    color: "#0f172a",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  idText: {
    fontSize: 8,
    color: "#2563eb",
    fontFamily: "Helvetica",
  },
  badge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    fontSize: 8,
    color: "#475569",
    marginTop: 2,
    alignSelf: "flex-start",
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

export const HistoryReportDocument = ({ audits = [] }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Audit History Report</Text>
          <Text style={styles.subtitle}>Complete log of all security and compliance audits</Text>
          <Text style={styles.subtitle}>Total Records: {audits.length}</Text>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colID, styles.tableHeader]}>Audit ID</Text>
          <Text style={[styles.colTarget, styles.tableHeader]}>Target</Text>
          <Text style={[styles.colFW, styles.tableHeader]}>Frameworks</Text>
          <Text style={[styles.colStats, styles.tableHeader]}>Findings / Risk</Text>
          <Text style={[styles.colDate, styles.tableHeader]}>Date</Text>
        </View>

        {audits.map((a, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <View style={styles.colID}>
              <Text style={styles.idText}>{String(a.id).slice(-12).toUpperCase()}</Text>
              <Text style={styles.badge}>{a.status}</Text>
            </View>
            <View style={styles.colTarget}>
              <Text style={[styles.text, styles.bold]}>{a.target}</Text>
            </View>
            <View style={styles.colFW}>
              <Text style={styles.text}>{a.framework}</Text>
            </View>
            <View style={styles.colStats}>
              <Text style={styles.text}>{a.findings} Findings</Text>
              <Text style={[styles.text, { color: a.risk > 50 ? "#e11d48" : "#16a34a", marginTop: 2 }]}>
                Score: {a.risk || "—"}
              </Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.text}>{a.date}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>
    </Document>
  );
};

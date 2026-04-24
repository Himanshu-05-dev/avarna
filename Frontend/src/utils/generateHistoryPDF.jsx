import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { HistoryReportDocument } from '../features/report/components/HistoryReportDocument';

export const generateHistoryPDF = async (audits, filename = 'Audit_History.pdf') => {
  if (!audits || audits.length === 0) {
    toast.error("No audit history available to export.");
    return;
  }

  const toastId = toast.loading("Generating history PDF document...");

  try {
    const blob = await pdf(<HistoryReportDocument audits={audits} />).toBlob();
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("History report downloaded successfully!", { id: toastId });
  } catch (error) {
    console.error("PDF generation error:", error);
    toast.error(`PDF Error: ${error.message || "Failed to generate document"}`, { id: toastId });
  }
};

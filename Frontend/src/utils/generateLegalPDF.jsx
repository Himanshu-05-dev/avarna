import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { LegalReportDocument } from '../features/report/components/LegalReportDocument';

/**
 * Programmatically generates a highly detailed, text-selectable PDF 
 * document using @react-pdf/renderer and triggers a browser download.
 */
export const generateLegalPDF = async (auditData, filename = 'Formal_Analysis_Report.pdf') => {
  if (!auditData) {
    toast.error("No audit data available to export.");
    return;
  }

  const toastId = toast.loading("Generating formal PDF document...");

  try {
    // Generate the PDF blob using the formal document layout
    const blob = await pdf(<LegalReportDocument data={auditData} />).toBlob();
    
    // Create a temporary link to trigger the download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Formal report downloaded successfully!", { id: toastId });
  } catch (error) {
    console.error("PDF generation error:", error);
    toast.error(`PDF Error: ${error.message || "Failed to generate document"}`, { id: toastId });
  }
};

import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const exportToPDF = async (elementId, filename = "export.pdf") => {
  const element = document.getElementById(elementId);
  if (!element) {
    toast.error("Could not find the content to export.");
    return;
  }

  const toastId = toast.loading("Generating PDF...");

  try {
    const dataUrl = await domtoimage.toPng(element, {
      quality: 1,
      bgcolor: "#ffffff"
    });
    
    // Handle potential bundler quirks with jsPDF exports
    const PDFDoc = jsPDF.jsPDF ? jsPDF.jsPDF : jsPDF;
    const pdf = new PDFDoc("p", "mm", "a4");
    
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (img.height * pdfWidth) / img.width;
    
    // If the content is taller than one page, jsPDF handles it automatically when we use AddPage, 
    // but for simplicity we can just scale it to fit one page width, and allow it to overflow down.
    // To handle multiple pages:
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    toast.success("Report downloaded successfully!", { id: toastId });
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error(`PDF Error: ${error.message || "Unknown error"}`, { id: toastId });
  }
};

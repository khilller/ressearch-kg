export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Try pdf-parse first (more compatible with Workers)
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    return data.text;
    
  } catch (pdfParseError) {
    console.warn('pdf-parse failed, trying manual PDF.js approach:', pdfParseError);
    // Add implementation for manual PDF.js approach here
    return ''; // Replace with actual fallback implementation
  }
}

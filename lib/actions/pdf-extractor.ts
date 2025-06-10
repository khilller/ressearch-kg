export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Try pdf-parse first (more compatible with Workers)
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    return data.text;
    
  } catch (pdfParseError) {
    console.warn('pdf-parse failed, trying manual PDF.js approach:', pdfParseError);
    
    try {
      // Fallback to manual PDF.js with different import strategy
      return await extractWithManualPDFJS(buffer);
      
    } catch (pdfjsError) {
      console.error('Both PDF extraction methods failed');
      
      // Last resort: Return an error message that suggests user convert to text
      throw new Error(`PDF extraction not supported in this environment. Please convert your PDF to text format first. Details: ${pdfParseError instanceof Error ? pdfParseError.message : 'Unknown error'}`);
    }
  }
}

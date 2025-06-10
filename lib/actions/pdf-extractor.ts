// lib/actions/pdf-extractor-robust.ts

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid build-time issues
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Configure worker settings for server environment
    if (pdfjs.GlobalWorkerOptions) {
      // Disable worker in server environment by setting to empty string
      (pdfjs.GlobalWorkerOptions as any).workerSrc = '';
    }
    
    // Convert Buffer to Uint8Array for PDF.js
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document with server-optimized options
    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      useWorkerFetch: false,           // Critical: Disable worker fetch
      isEvalSupported: false,          // Disable eval for security
      useSystemFonts: false,           // Don't rely on system fonts
      standardFontDataUrl: undefined,  // Don't load standard fonts
      cMapUrl: undefined,              // Don't load character maps
      cMapPacked: false,
      disableAutoFetch: true,          // Disable automatic fetching
      disableStream: true,             // Disable streaming
      disableRange: true,              // Disable range requests
      verbosity: 0                     // Disable logging
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item: any) => {
          // Handle both TextItem and TextMarkedContent
          return 'str' in item ? item.str : '';
        })
        .filter(Boolean)
        .join(' ');
      
      fullText += pageText;
      
      // Add newline between pages for better text structure
      if (pageNum < pdf.numPages) {
        fullText += '\n\n';
      }
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
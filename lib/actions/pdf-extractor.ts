// lib/actions/pdf-extractor.ts
import * as pdfjsLib from 'pdfjs-dist'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for PDF.js
    const uint8Array = new Uint8Array(buffer)
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,    // Disable worker for edge compatibility
      isEvalSupported: false,   // Disable eval for security
      useSystemFonts: true      // Better text extraction
    }).promise
    
    let fullText = ''
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item) => {
          // item.str contains the actual text content (only exists on TextItem, not TextMarkedContent)
          return 'str' in item ? item.str || '' : ''
        })
        .join('')
      
      // Add page text to full text (same format as LangChain)
      fullText += pageText
      
      // Add separator between pages (mimics LangChain's parsedItemSeparator: "")
      if (pageNum < pdf.numPages) {
        fullText += ''  // Keep same separator as your LangChain config
      }
    }
    
    return fullText || ''
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}
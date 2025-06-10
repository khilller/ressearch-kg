 import { extractText, getDocumentProxy } from 'unpdf'

 export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log(`Processing PDF buffer of size: ${buffer.length} bytes`)
    
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer)
    
    // Get PDF document proxy
     const pdf = await getDocumentProxy(uint8Array)
    
    // Extract all text with pages merged
    const { totalPages, text } = await extractText(pdf, {        mergePages: true 
    })
    
    console.log(`Successfully extracted ${text.length} characters from ${totalPages} pages`)
    
    // Basic text cleaning for better LLM processing
     const cleanedText = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim()
    
     return cleanedText
     
  } catch (error) {
    console.error('unpdf extraction failed:', error)
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
 }
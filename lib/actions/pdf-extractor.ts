// src/lib/pdf-extractor.ts


import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";


export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Blob for PDFLoader
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const data = new PDFLoader(blob)
    const documents = await data.load()
    return documents.map(doc => doc.pageContent).join('\n') || ''
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

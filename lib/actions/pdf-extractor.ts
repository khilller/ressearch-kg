// src/lib/pdf-extractor.ts


import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";


export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = new PDFLoader(buffer)
    const documents = await data.load()
    return documents[0].pageContent || ''
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

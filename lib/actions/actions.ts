'use server'

import type { KnowledgeGraphSuggestionsType, ProcessingResult, ProcessingDetails } from '@/lib/types/types'

export async function getSuggestionsAction(
  researchFocus: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _files: FormData
): Promise<KnowledgeGraphSuggestionsType> {
  try {
    // Lazy load the AI suggestions module
    const { getAISuggestions } = await import('@/lib/actions/ai-sugesstions')
    const suggestions = await getAISuggestions(researchFocus)
    return suggestions
  } catch (error) {
    console.error('Error getting AI suggestions:', error)
    throw new Error('Failed to get AI suggestions')
  }
}

export async function processDocumentsAction(
  files: FormData,
  selectedEntities: string[],
  selectedRelationships: string[]
): Promise<ProcessingResult> {
  try {
    const fileEntries = files.getAll('files') as File[]
    
    if (fileEntries.length === 0) {
      throw new Error('No files provided')
    }

    // Lazy load heavy modules only when needed
    const [
      { extractTextFromPDF }, // Now using unpdf instead of pdf-parse
      { processDocumentsToGraph }
    ] = await Promise.all([
      import('@/lib/actions/pdf-extractor'), // Updated import
      import('@/lib/actions/graph-processor')
    ])

    // Extract text from all PDFs with progress tracking
    const documentTexts: string[] = []
    const documentNames: string[] = []
    
    for (let i = 0; i < fileEntries.length; i++) {
      const file = fileEntries[i]
      console.log(`Extracting text from ${file.name} (${i + 1}/${fileEntries.length})`)
      
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Use new unpdf-based extractor
      const text = await extractTextFromPDF(buffer)
      documentTexts.push(text)
      documentNames.push(file.name.replace('.pdf', ''))
      
      console.log(`Extracted ${text.length} characters from ${file.name}`)
    }

    // Process documents with enhanced feedback
    const graphData = await processDocumentsToGraph(
      documentTexts,
      selectedEntities,
      selectedRelationships,
      documentNames
    )

    return {
      success: true,
      data: graphData
    }
  } catch (error) {
    console.error('Error processing documents:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// Enhanced streaming version with better error handling
export async function processDocumentsStreamAction(
  files: FormData,
  selectedEntities: string[],
  selectedRelationships: string[]
) {
  const encoder = new TextEncoder()
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const fileEntries = files.getAll('files') as File[]
          
          if (fileEntries.length === 0) {
            controller.enqueue(encoder.encode('data: {"status": "error", "error": "No files provided"}\n\n'))
            controller.close()
            return
          }

          // Send initial status immediately
          controller.enqueue(encoder.encode('data: {"status": "starting", "progress": 0, "message": "Initializing processing..."}\n\n'))

          // Lazy load the new PDF extractor
          controller.enqueue(encoder.encode('data: {"status": "loading", "progress": 5, "message": "Loading unpdf PDF extractor..."}\n\n'))
          
          const { extractTextFromPDF } = await import('@/lib/actions/pdf-extractor')

          // Extract text from all PDFs with progress updates
          const documentTexts: string[] = []
          const documentNames: string[] = []
          
          for (let i = 0; i < fileEntries.length; i++) {
            const file = fileEntries[i]
            const progress = Math.round(10 + (i / fileEntries.length) * 25) // 10-35% for PDF extraction
            
            controller.enqueue(encoder.encode(`data: {"status": "extracting", "progress": ${progress}, "message": "Extracting text from ${file.name} using unpdf...", "currentFile": "${file.name}", "fileIndex": ${i + 1}, "totalFiles": ${fileEntries.length}}\n\n`))
            
            try {
              const buffer = Buffer.from(await file.arrayBuffer())
              const text = await extractTextFromPDF(buffer)
              documentTexts.push(text)
              documentNames.push(file.name.replace('.pdf', ''))
              
              console.log(`Extracted ${text.length} characters from ${file.name}`)
              
              // Small delay to prevent timeout detection
              await new Promise(resolve => setTimeout(resolve, 50))
              
            } catch (extractionError) {
              console.error(`Failed to extract ${file.name}:`, extractionError)
              controller.enqueue(encoder.encode(`data: {"status": "error", "error": "Failed to extract text from ${file.name}: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}"}\n\n`))
              controller.close()
              return
            }
          }

          controller.enqueue(encoder.encode('data: {"status": "processing", "progress": 35, "message": "Starting entity extraction with improved PDF content..."}\n\n'))

          // Process documents with streaming progress callback
          const graphData = await processDocumentsToGraphWithProgress(
            documentTexts,
            selectedEntities,
            selectedRelationships,
            documentNames,
            (progress: number, message: string, details?: ProcessingDetails) => {
              const totalProgress = Math.min(35 + Math.round(progress * 0.65), 100) // 65% for processing
              controller.enqueue(encoder.encode(`data: {"status": "processing", "progress": ${totalProgress}, "message": "${message}", "details": ${JSON.stringify(details || {})}}\n\n`))
            }
          )

          // Send completion
          controller.enqueue(encoder.encode(`data: {"status": "complete", "progress": 100, "message": "Processing complete with unpdf!", "data": ${JSON.stringify(graphData)}}\n\n`))
          controller.close()

        } catch (error) {
          console.error('Streaming processing error:', error)
          controller.enqueue(encoder.encode(`data: {"status": "error", "error": "${error instanceof Error ? error.message : 'Unknown error occurred'}"}\n\n`))
          controller.close()
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    }
  )
}

// Enhanced version of processDocumentsToGraph with progress callbacks
async function processDocumentsToGraphWithProgress(
  documentTexts: string[],
  allowedEntities: string[],
  allowedRelationships: string[],
  documentNames?: string[],
  progressCallback?: (progress: number, message: string, details?: ProcessingDetails) => void
) {
  // Lazy load the graph processor
  const { processDocumentsToGraph } = await import('@/lib/actions/graph-processor')
  
  progressCallback?.(0, "Starting document analysis...")
  
  const result = await processDocumentsToGraph(
    documentTexts,
    allowedEntities,
    allowedRelationships,
    documentNames
  )
  
  progressCallback?.(100, "Document processing complete")
  return result
}
// src/app/actions.ts
'use server'

import { getAISuggestions } from '@/lib/actions/ai-sugesstions'
import { processDocumentsToGraph } from '@/lib/actions/graph-processor'
import { extractTextFromPDF } from '@/lib/actions/pdf-extractor'
import type { KnowledgeGraphSuggestionsType, ProcessingResult } from '@/lib/types/types'

export async function getSuggestionsAction(
  researchFocus: string,
  files: FormData
): Promise<KnowledgeGraphSuggestionsType> {
  try {
    // Extract preview text from first file
    const firstFile = files.get('files') as File
    let documentPreview = ''
    
    if (firstFile) {
      const buffer = Buffer.from(await firstFile.arrayBuffer())
      documentPreview = await extractTextFromPDF(buffer)
    }

    const suggestions = await getAISuggestions(researchFocus, documentPreview)
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

    // Extract text from all PDFs
    const documentTexts: string[] = []
    
    for (const file of fileEntries) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractTextFromPDF(buffer)
      documentTexts.push(text)
    }

    // Process with LangChain
    const graphData = await processDocumentsToGraph(
      documentTexts,
      selectedEntities,
      selectedRelationships
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
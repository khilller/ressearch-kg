import { z } from 'zod'

export const KnowledgeGraphSuggestions = z.object({
  entities: z.array(z.string()).describe("Suggested entity types to extract"),
  relationships: z.array(z.string()).describe("Suggested relationship types to extract"),
  reasoning: z.string().describe("Brief explanation of why these suggestions fit the research focus")
})

export type KnowledgeGraphSuggestionsType = z.infer<typeof KnowledgeGraphSuggestions>

export interface GraphNode {
  id: string
  type: string
  properties: Record<string, unknown>
}

export interface GraphRelationship {
  source: string
  target: string
  type: string
  properties: Record<string, unknown>
}

export interface GraphData {
  nodes: GraphNode[]
  relationships: GraphRelationship[]
}

export interface ProcessingResult {
  success: boolean
  data?: GraphData
  error?: string
}

export interface ProcessingDetails {
  entities?: number
  relationships?: number
  document?: number
  chunk?: number
  totalChunks?: number
  totalDocuments?: number
}

export interface ProcessingProgress {
  status: string
  progress: number
  message: string
  data?: GraphData
  error?: string
  details?: ProcessingDetails
  currentFile?: string
  fileIndex?: number
  totalFiles?: number
}
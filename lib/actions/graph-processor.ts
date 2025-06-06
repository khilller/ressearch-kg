import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { z } from "zod"
import type { GraphData, GraphNode, GraphRelationship, ProcessingDetails } from "@/lib/types/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Schema for extracting entities and relationships from text
const KnowledgeGraphExtraction = z.object({
  entities: z.array(z.object({
    name: z.string().describe("The name/identifier of the entity"),
    type: z.string().describe("The type/category of the entity"),
    description: z.string().describe("Brief description of the entity")
  })),
  relationships: z.array(z.object({
    source: z.string().describe("The source entity name"),
    target: z.string().describe("The target entity name"),
    type: z.string().describe("The type of relationship"),
    description: z.string().describe("Description of the relationship")
  }))
})

// Schema for merging duplicate entities
const EntityMerging = z.object({
  mergedEntities: z.array(z.object({
    canonicalName: z.string().describe("The canonical/preferred name for this entity"),
    variations: z.array(z.string()).describe("All variations of this entity name that should be merged"),
    type: z.string().describe("The entity type")
  })),
  reasoning: z.string().describe("Brief explanation of the merging decisions")
})

// Chunk text into smaller pieces (8k characters for faster processing)
function chunkText(text: string, maxChars: number = 8000): string[] {
  // Split by sentences to preserve context
  const sentences = text.split(/[.!?]+/)
  const chunks: string[] = []
  let currentChunk = ""
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue
    
    if (currentChunk.length + trimmedSentence.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = trimmedSentence + ". "
    } else {
      currentChunk += trimmedSentence + ". "
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.length > 0 ? chunks : [text]
}

// Extract entities and relationships from a single text chunk using OpenAI
async function extractFromChunk(
  text: string,
  allowedEntities: string[],
  allowedRelationships: string[]
): Promise<{ nodes: GraphNode[], relationships: GraphRelationship[] }> {
  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured knowledge from text. Extract entities and relationships from the given text.

          Entity Types to look for: ${allowedEntities.join(", ")}
          Relationship Types to look for: ${allowedRelationships.join(", ")}

          Guidelines:
          - Only extract entities that match the specified types
          - Only extract relationships that match the specified types
          - Be precise and avoid duplicates within this text chunk
          - Use exact names as they appear in the text
          - Focus on clear, explicit relationships mentioned in the text`
        },
        {
          role: "user",
          content: `Extract entities and relationships from this text:\n\n${text}`
        }
      ],
      response_format: zodResponseFormat(KnowledgeGraphExtraction, "knowledge_extraction")
    })

    const extraction = response.choices[0].message.parsed
    if (!extraction) {
      console.warn("Failed to parse extraction from chunk")
      return { nodes: [], relationships: [] }
    }

    // Convert to our format
    const nodes: GraphNode[] = extraction.entities.map(entity => ({
      id: entity.name,
      type: entity.type,
      properties: { description: entity.description }
    }))

    const relationships: GraphRelationship[] = extraction.relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: rel.type,
      properties: { description: rel.description }
    }))

    return { nodes, relationships }
  } catch (error) {
    console.error("Error extracting from chunk:", error)
    return { nodes: [], relationships: [] }
  }
}

// Use LLM to merge similar entities across batches
async function mergeEntitiesWithLLM(
  allNodes: GraphNode[],
  progressCallback?: (progress: number, message: string) => void
): Promise<Map<string, string>> {
  if (allNodes.length <= 1) return new Map()

  progressCallback?.(0, "Grouping entities by type...")

  // Group entities by type for more targeted merging
  const entitiesByType = new Map<string, string[]>()
  
  for (const node of allNodes) {
    if (!entitiesByType.has(node.type)) {
      entitiesByType.set(node.type, [])
    }
    entitiesByType.get(node.type)!.push(node.id)
  }

  const entityMapping = new Map<string, string>()
  const entityTypes = Array.from(entitiesByType.keys())
  
  // Process each entity type separately
  for (let typeIndex = 0; typeIndex < entityTypes.length; typeIndex++) {
    const type = entityTypes[typeIndex]
    const entities = entitiesByType.get(type)!
    const uniqueEntities = [...new Set(entities)]
    
    const progress = (typeIndex / entityTypes.length) * 100
    progressCallback?.(progress, `Merging ${type} entities (${uniqueEntities.length} found)...`)
    
    if (uniqueEntities.length <= 1) continue

    try {
      console.log(`Merging ${uniqueEntities.length} entities of type: ${type}`)
      
      const response = await openai.chat.completions.parse({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are an expert at identifying duplicate entities in knowledge graphs. 
            Given a list of entity names of the same type, identify which ones refer to the same real-world entity.
            
            Rules:
            - Consider variations in naming, abbreviations, and formatting
            - Be conservative - only merge if you're confident they're the same entity
            - Choose the most complete/formal name as the canonical version
            - Different entities should remain separate even if they're similar`
          },
          {
            role: "user",
            content: `Entity type: ${type}
            Entity names: ${uniqueEntities.join(", ")}
            
            Identify which entities should be merged and provide the canonical name for each group.`
          }
        ],
        response_format: zodResponseFormat(EntityMerging, "entity_merging")
      })

      const merging = response.choices[0].message.parsed
      if (merging) {
        console.log(`Merging reasoning: ${merging.reasoning}`)
        for (const merged of merging.mergedEntities) {
          for (const variation of merged.variations) {
            if (variation !== merged.canonicalName) {
              entityMapping.set(variation, merged.canonicalName)
            }
          }
        }
      }
      
      // Small delay to prevent timeout detection
      await new Promise(resolve => setTimeout(resolve, 50))
      
    } catch (error) {
      console.warn(`Failed to merge entities for type ${type}:`, error)
    }
  }

  progressCallback?.(100, "Entity merging complete")
  return entityMapping
}

// Apply entity mapping and remove duplicate relationships
function consolidateGraph(
  allNodes: GraphNode[],
  allRelationships: GraphRelationship[],
  entityMapping: Map<string, string>
): GraphData {
  // Apply entity mapping to nodes and remove duplicates
  const nodeMap = new Map<string, GraphNode>()
  
  for (const node of allNodes) {
    const canonicalId = entityMapping.get(node.id) || node.id
    if (!nodeMap.has(canonicalId)) {
      nodeMap.set(canonicalId, {
        ...node,
        id: canonicalId
      })
    }
  }

  // Apply entity mapping to relationships and remove duplicates
  const relationshipSet = new Set<string>()
  const finalRelationships: GraphRelationship[] = []

  for (const rel of allRelationships) {
    const canonicalSource = entityMapping.get(rel.source) || rel.source
    const canonicalTarget = entityMapping.get(rel.target) || rel.target
    
    // Skip self-relationships
    if (canonicalSource === canonicalTarget) continue
    
    // Skip if source or target doesn't exist in final nodes
    if (!nodeMap.has(canonicalSource) || !nodeMap.has(canonicalTarget)) continue
    
    const relationshipKey = `${canonicalSource}|${rel.type}|${canonicalTarget}`
    if (!relationshipSet.has(relationshipKey)) {
      relationshipSet.add(relationshipKey)
      finalRelationships.push({
        ...rel,
        source: canonicalSource,
        target: canonicalTarget
      })
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    relationships: finalRelationships
  }
}

// Main function with progress callbacks and document nodes
export async function processDocumentsToGraph(
  documentTexts: string[],
  allowedEntities: string[],
  allowedRelationships: string[],
  documentNames?: string[],
  progressCallback?: (progress: number, message: string, details?: ProcessingDetails) => void
): Promise<GraphData> {
  console.log("Processing documents with direct OpenAI calls...")
  console.log(`Documents: ${documentTexts.length}`)
  console.log(`Entity types: ${allowedEntities.join(", ")}`)
  console.log(`Relationship types: ${allowedRelationships.join(", ")}`)
  
  const allNodes: GraphNode[] = []
  const allRelationships: GraphRelationship[] = []
  
  // Create document nodes as the main nodes
  const documentNodes: GraphNode[] = documentTexts.map((text, index) => ({
    id: documentNames?.[index] || `Document ${index + 1}`,
    type: "DOCUMENT",
    properties: { 
      description: `Source document with ${text.length} characters`,
      length: text.length 
    }
  }))
  
  allNodes.push(...documentNodes)
  progressCallback?.(0, "Created document nodes")
  
  // Calculate total chunks for progress tracking
  const allChunks = documentTexts.map(text => chunkText(text, 8000))
  const totalChunks = allChunks.reduce((sum, chunks) => sum + chunks.length, 0)
  let processedChunks = 0
  
  // Process each document
  for (let docIndex = 0; docIndex < documentTexts.length; docIndex++) {
    const text = documentTexts[docIndex]
    const documentId = documentNames?.[docIndex] || `Document ${docIndex + 1}`
    console.log(`\nProcessing document ${docIndex + 1}/${documentTexts.length} (${text.length} chars)`)
    
    // Chunk the document into 8k character pieces
    const chunks = allChunks[docIndex]
    console.log(`Split into ${chunks.length} chunks`)
    
    progressCallback?.(
      (processedChunks / totalChunks) * 70, 
      `Processing ${documentId} (${chunks.length} chunks)`,
      { document: docIndex + 1, totalDocuments: documentTexts.length }
    )
    
    // Process each chunk with OpenAI
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      console.log(`  Processing chunk ${chunkIndex + 1}/${chunks.length}`)
      
      progressCallback?.(
        (processedChunks / totalChunks) * 70,
        `Processing ${documentId} - chunk ${chunkIndex + 1}/${chunks.length}`,
        { 
          document: docIndex + 1, 
          chunk: chunkIndex + 1, 
          totalChunks: chunks.length,
          entities: allNodes.length,
          relationships: allRelationships.length
        }
      )
      
      try {
        const { nodes, relationships } = await extractFromChunk(
          chunks[chunkIndex],
          allowedEntities,
          allowedRelationships
        )
        
        allNodes.push(...nodes)
        allRelationships.push(...relationships)
        
        // Add relationships from document to extracted entities
        for (const node of nodes) {
          allRelationships.push({
            source: documentId,
            target: node.id,
            type: "CONTAINS",
            properties: { description: `Document contains this ${node.type.toLowerCase()}` }
          })
        }
        
        console.log(`    Found ${nodes.length} entities, ${relationships.length} relationships`)
        
        // Small delay to prevent timeout detection every 3 chunks
        if (chunkIndex % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
      } catch (error) {
        console.error(`    Error processing chunk ${chunkIndex + 1}:`, error)
      }
      
      processedChunks++
    }
  }
  
  console.log(`\nTotal extracted: ${allNodes.length} entities, ${allRelationships.length} relationships`)
  progressCallback?.(70, `Extracted ${allNodes.length} entities from all documents`)
  
  // Skip merging if no entities found (except document nodes)
  if (allNodes.length <= documentNodes.length) {
    console.log("No entities found besides document nodes")
    progressCallback?.(100, "Processing complete - no entities found")
    return { nodes: documentNodes, relationships: [] }
  }
  
  // Merge duplicate entities using LLM (exclude document nodes)
  console.log("\nMerging duplicate entities...")
  progressCallback?.(75, "Starting entity merging process...")
  
  const nonDocumentNodes = allNodes.filter(node => node.type !== "DOCUMENT")
  let entityMapping: Map<string, string>
  
  try {
    entityMapping = await mergeEntitiesWithLLM(
      nonDocumentNodes,
      (progress, message) => {
        progressCallback?.(75 + (progress * 0.15), message) // 15% for merging
      }
    )
    console.log(`Merged ${entityMapping.size} duplicate entities`)
  } catch (error) {
    console.warn("Entity merging failed:", error)
    entityMapping = new Map()
  }
  
  // Consolidate the final graph
  progressCallback?.(90, "Consolidating final graph...")
  const finalGraph = consolidateGraph(allNodes, allRelationships, entityMapping)
  
  console.log(`\nFinal graph: ${finalGraph.nodes.length} entities, ${finalGraph.relationships.length} relationships`)
  progressCallback?.(100, `Processing complete! Found ${finalGraph.nodes.length} entities and ${finalGraph.relationships.length} relationships`)
  
  return finalGraph
}
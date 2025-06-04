import { ChatOpenAI } from "@langchain/openai"
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm"
import { Document } from "@langchain/core/documents"
import type { GraphData } from "@/lib/types/types"

const model = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY
})

export async function processDocumentsToGraph(
  documentTexts: string[],
  allowedEntities: string[],
  allowedRelationships: string[]
): Promise<GraphData> {
  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: allowedEntities.map(e => e.toUpperCase()),
    allowedRelationships: allowedRelationships,
    strictMode: false
  })

  // Convert document texts to LangChain Documents
  const documents = documentTexts.map(text => 
    new Document({ pageContent: text })
  )

  const results = await llmGraphTransformer.convertToGraphDocuments(documents)
  
  // Combine all results into a single graph
  const allNodes = results.flatMap(result => result.nodes)
  const allRelationships = results.flatMap(result => result.relationships)

  // Convert to our format
  const nodes = allNodes.map(node => ({
    id: String(node.id),
    type: node.type,
    properties: node.properties || {}
  }))

  const relationships = allRelationships.map(rel => ({
    source: String(rel.source.id),
    target: String(rel.target.id),
    type: rel.type,
    properties: rel.properties || {}
  }))

  return { nodes, relationships }
}

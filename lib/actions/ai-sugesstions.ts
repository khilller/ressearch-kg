import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { KnowledgeGraphSuggestions, type KnowledgeGraphSuggestionsType } from "@/lib/types/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function getAISuggestions(
  researchFocus: string
): Promise<KnowledgeGraphSuggestionsType> {
  const response = await openai.chat.completions.parse({
    model: "gpt-4.1-2025-04-14",
    messages: [
      {
        role: "system",
        content: `You are an expert in knowledge graph design. Based on a user's research focus description, suggest relevant entity types and relationship types that would be most useful for extracting a knowledge graph.

        Guidelines:
        - Suggest 3-8 entity types that are specific to the research domain
        - Suggest 4-10 relationship types that commonly occur in that domain
        - Focus on entities and relationships that would frequently appear in documents
        - Make suggestions actionable and specific to the research area
        - Consider both direct relationships and indirect connections`
      },
      {
        role: "user",
        content: `Research Focus: ${researchFocus}

Based on this research focus, what entity types and relationship types would be most valuable for building a knowledge graph?`
      }
    ],
    response_format: zodResponseFormat(KnowledgeGraphSuggestions, "suggestions")
  })

  const suggestions = response.choices[0].message.parsed
  if (!suggestions) {
    throw new Error("Failed to parse AI suggestions")
  }

  return suggestions
}
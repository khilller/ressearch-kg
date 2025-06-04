import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { KnowledgeGraphSuggestions } from "@/lib/types/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function getAISuggestions(
  researchFocus: string,
  documentPreview: string
): Promise<typeof KnowledgeGraphSuggestions> {
  const response = await openai.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content: "Based on the research focus and document samples, suggest relevant entity types and relationship types for knowledge graph extraction. Focus on the most important and frequently occurring concepts."
      },
      {
        role: "user",
        content: `Research Focus: ${researchFocus}\n\nDocument Sample: ${documentPreview.slice(0, 2000)}`
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

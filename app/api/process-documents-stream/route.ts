import { NextRequest } from 'next/server'
import { processDocumentsStreamAction } from '@/lib/actions/actions'

export async function POST(request: NextRequest) {
  try {
    // Get form data and headers
    const formData = await request.formData()
    const selectedEntitiesHeader = request.headers.get('X-Selected-Entities')
    const selectedRelationshipsHeader = request.headers.get('X-Selected-Relationships')

    if (!selectedEntitiesHeader || !selectedRelationshipsHeader) {
      return new Response('Missing entity or relationship headers', { status: 400 })
    }

    const selectedEntities = JSON.parse(selectedEntitiesHeader)
    const selectedRelationships = JSON.parse(selectedRelationshipsHeader)

    // Call the streaming action
    return await processDocumentsStreamAction(
      formData,
      selectedEntities,
      selectedRelationships
    )
  } catch (error) {
    console.error('API route error:', error)
    return new Response(
      `data: {"status": "error", "error": "${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      }
    )
  }
}
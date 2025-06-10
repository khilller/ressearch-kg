// In app/api/process-documents-stream/route.ts

import { NextRequest } from 'next/server'
import { processDocumentsStreamAction } from '@/lib/actions/actions'

export async function POST(request: NextRequest) {
  try {
    // Get form data and headers
    const formData = await request.formData()
    const selectedEntitiesHeaderB64 = request.headers.get('X-Selected-Entities-B64')
    const selectedRelationshipsHeaderB64 = request.headers.get('X-Selected-Relationships-B64')

    if (!selectedEntitiesHeaderB64 || !selectedRelationshipsHeaderB64) {
      return new Response('Missing entity or relationship headers', { status: 400 })
    }

    // Decode base64 and parse JSON
    let selectedEntities: string[]
    let selectedRelationships: string[]
    
    try {
      selectedEntities = JSON.parse(atob(selectedEntitiesHeaderB64))
      selectedRelationships = JSON.parse(atob(selectedRelationshipsHeaderB64))
    } catch (decodeError) {
      console.error('Failed to decode headers:', decodeError)
      return new Response('Invalid header encoding', { status: 400 })
    }

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
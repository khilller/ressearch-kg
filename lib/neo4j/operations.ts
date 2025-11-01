import { getDriver } from './client'
import type { GraphData, GraphNode, GraphRelationship } from '@/lib/types/types'

export async function saveGraphToNeo4j(graphData: GraphData): Promise<void> {
  const driver = getDriver()
  const session = driver.session()

  try {
    console.log(`Saving ${graphData.nodes.length} nodes and ${graphData.relationships.length} relationships to Neo4j...`)

    // Save nodes in batches
    if (graphData.nodes.length > 0) {
      await session.run(
        `
        UNWIND $nodes AS node
        MERGE (n {id: node.id})
        SET n = node.properties
        SET n.type = node.type
        SET n.id = node.id
        `,
        { nodes: graphData.nodes }
      )
      console.log(`✅ Saved ${graphData.nodes.length} nodes`)
    }

    // Save relationships in batches
    // Save relationships in batches
    // Save relationships - batch by type for performance
    if (graphData.relationships.length > 0) {
        const relsByType = new Map<string, GraphRelationship[]>()
        
        for (const rel of graphData.relationships) {
            // Convert to uppercase and replace non-alphanumeric with underscore
            const type = (rel.type || 'RELATES')
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_')
            
            if (!relsByType.has(type)) relsByType.set(type, [])
            relsByType.get(type)!.push(rel)
        }

        for (const [type, rels] of relsByType.entries()) {
            const query = `
            UNWIND $rels AS rel
            MATCH (source {id: rel.source})
            MATCH (target {id: rel.target})
            MERGE (source)-[r:\`${type}\`]->(target)
            SET r = rel.properties
            `
            await session.run(query, { rels })
            console.log(`✅ Saved ${rels.length} ${type} relationships`)
        }
    }

    console.log('✅ Graph saved to Neo4j successfully')
  } catch (error) {
    console.error('❌ Error saving graph to Neo4j:', error)
    throw error
  } finally {
    await session.close()
  }
}

export async function getGraphFromNeo4j(): Promise<GraphData> {
  const driver = getDriver()
  const session = driver.session()

  try {
    console.log('Loading graph from Neo4j...')

    const result = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN n, r, m
    `)

    // Use Maps to avoid duplicates
    const nodesMap = new Map<string, GraphNode>()
    const relationshipsSet = new Set<string>()
    const relationships: GraphRelationship[] = []

    for (const record of result.records) {
      const n = record.get('n')
      if (n) {
        nodesMap.set(n.properties.id, {
          id: n.properties.id,
          type: n.properties.type || 'Unknown',
          properties: n.properties
        })
      }

      const m = record.get('m')
      if (m) {
        nodesMap.set(m.properties.id, {
          id: m.properties.id,
          type: m.properties.type || 'Unknown',
          properties: m.properties
        })
      }

      const r = record.get('r')
      if (r) {
        const relKey = `${n.properties.id}|${r.type}|${m.properties.id}`
        if (!relationshipsSet.has(relKey)) {
          relationshipsSet.add(relKey)
          relationships.push({
            source: n.properties.id,
            target: m.properties.id,
            type: r.properties.type || r.type,
            properties: r.properties
          })
        }
      }
    }

    const graphData = {
      nodes: Array.from(nodesMap.values()),
      relationships
    }

    console.log(`✅ Loaded ${graphData.nodes.length} nodes and ${graphData.relationships.length} relationships`)
    return graphData
  } catch (error) {
    console.error('❌ Error loading graph from Neo4j:', error)
    throw error
  } finally {
    await session.close()
  }
}

export async function clearGraph(): Promise<void> {
  const driver = getDriver()
  const session = driver.session()

  try {
    console.log('Clearing graph...')
    const result = await session.run('MATCH (n) DETACH DELETE n')
    console.log(`✅ Cleared graph (deleted nodes)`)
  } catch (error) {
    console.error('❌ Error clearing graph:', error)
    throw error
  } finally {
    await session.close()
  }
}
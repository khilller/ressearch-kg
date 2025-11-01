import neo4j, { Driver, Session } from 'neo4j-driver'

let driver: Driver | null = null

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USER
    const password = process.env.NEO4J_PASSWORD

    if (!uri || !user || !password) {
      throw new Error('Missing Neo4j credentials in .env.local')
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 120000, // 2 minutes
    })

    console.log('✅ Neo4j driver created')
  }

  return driver
}

export async function testConnection(): Promise<boolean> {
  try {
    const driver = getDriver()
    const session: Session = driver.session()
    
    const result = await session.run('RETURN 1 AS test')
    await session.close()
    
    const testValue = result.records[0].get('test')
    console.log('✅ Neo4j connection successful')
    return testValue.toNumber() === 1
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error)
    return false
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
    console.log('Neo4j driver closed')
  }
}
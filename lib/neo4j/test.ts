import dotenv from 'dotenv'
import { testConnection } from './client'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function test() {
  console.log('Testing Neo4j Aura connection...')
  const connected = await testConnection()
  console.log('Connected:', connected)
  process.exit(0)
}

test()
#!/usr/bin/env node

import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables
config({ path: '.env.local' });

async function setupAdminDatabase() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database');

    // Set schema
    await client.query('SET search_path TO sensumaster_dev, public');

    // Create orchestration_sessions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS orchestration_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        config JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created/verified orchestration_sessions table');

    // Create agents table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'idle',
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255),
        session_id INTEGER REFERENCES orchestration_sessions(id),
        config JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created/verified agents table');

    // Create tasks table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES agents(id),
        session_id INTEGER REFERENCES orchestration_sessions(id),
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255),
        description TEXT,
        input JSONB,
        output JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created/verified tasks table');

    // Create agent_communications table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_communications (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES agents(id),
        session_id INTEGER REFERENCES orchestration_sessions(id),
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255),
        type VARCHAR(100) DEFAULT 'interaction',
        input JSONB,
        output JSONB,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created/verified agent_communications table');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_tenant ON orchestration_sessions(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON orchestration_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_agents_session_id ON agents(session_id);
      CREATE INDEX IF NOT EXISTS idx_agents_user_tenant ON agents(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_comms_agent_id ON agent_communications(agent_id);
      CREATE INDEX IF NOT EXISTS idx_comms_session_id ON agent_communications(session_id);
      CREATE INDEX IF NOT EXISTS idx_comms_created_at ON agent_communications(created_at);
    `);
    console.log('✅ Created/verified database indexes');

    // Insert some sample data if tables are empty
    const sessionCount = await client.query('SELECT COUNT(*) FROM orchestration_sessions');
    if (parseInt(sessionCount.rows[0].count) === 0) {
      console.log('🗄️ Inserting sample data...');
      
      // Insert sample session
      const sessionResult = await client.query(`
        INSERT INTO orchestration_sessions (session_id, user_id, tenant_id, status, config)
        VALUES ('sample-session-001', 'bennie', 'visualizehr', 'completed', '{"mode": "multi-agent", "agents": ["queen", "research", "implementation"]}')
        RETURNING id
      `);
      const sessionId = sessionResult.rows[0].id;

      // Insert sample agents
      const agentResults = await client.query(`
        INSERT INTO agents (name, type, status, user_id, tenant_id, session_id, config)
        VALUES 
          ('Queen Agent', 'orchestrator', 'completed', 'bennie', 'visualizehr', $1, '{"role": "coordinator", "priority": "high"}'),
          ('Research Agent', 'researcher', 'completed', 'bennie', 'visualizehr', $1, '{"domains": ["technology", "market"], "depth": "comprehensive"}'),
          ('Implementation Agent', 'implementer', 'idle', 'bennie', 'visualizehr', $1, '{"frameworks": ["react", "node"], "testing": true}')
        RETURNING id
      `, [sessionId]);

      // Insert sample tasks
      for (const agent of agentResults.rows) {
        await client.query(`
          INSERT INTO tasks (agent_id, session_id, user_id, tenant_id, description, input, output, status)
          VALUES ($1, $2, 'bennie', 'visualizehr', $3, $4, $5, $6)
        `, [
          agent.id,
          sessionId,
          `Sample task for agent ${agent.id}`,
          JSON.stringify({ query: 'Analyze user requirements', priority: 'high' }),
          JSON.stringify({ result: 'Analysis completed successfully', confidence: 0.95 }),
          'completed'
        ]);
      }

      // Insert sample communications
      for (const agent of agentResults.rows) {
        await client.query(`
          INSERT INTO agent_communications (agent_id, session_id, user_id, tenant_id, type, input, output)
          VALUES ($1, $2, 'bennie', 'visualizehr', 'interaction', $3, $4)
        `, [
          agent.id,
          sessionId,
          JSON.stringify({ message: 'Initialize agent', context: 'session_start' }),
          JSON.stringify({ response: 'Agent initialized successfully', status: 'ready' })
        ]);
      }

      console.log('✅ Sample data inserted');
    }

    console.log('\n🎉 Admin dashboard database setup completed!');
    console.log('\n📊 Database Summary:');
    
    const tables = ['orchestration_sessions', 'agents', 'tasks', 'agent_communications'];
    for (const table of tables) {
      const count = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  - ${table}: ${count.rows[0].count} records`);
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupAdminDatabase().catch(console.error);

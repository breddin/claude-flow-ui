import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;

/**
 * Data Synchronization Service
 * Propagates session data from SQLite container storage to PostgreSQL
 */
class DataSyncService {
  constructor() {
    // SQLite connection (container storage)
    this.sqlite = new Database('./agent_database.sqlite');
    
    // PostgreSQL connection (persistent storage)
    this.pgPool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Sync orchestration sessions from SQLite to PostgreSQL
   */
  async syncOrchestrationSessions() {
    console.log('🔄 Syncing orchestration sessions...');
    
    try {
      // Get all sessions from SQLite
      const sqliteSessions = this.sqlite.prepare(`
        SELECT * FROM orchestration_sessions 
        ORDER BY start_time DESC
      `).all();

      if (sqliteSessions.length === 0) {
        console.log('📭 No sessions found in SQLite');
        return;
      }

      const client = await this.pgPool.connect();
      try {
        await client.query('SET search_path TO sensumaster_dev, public');

        for (const session of sqliteSessions) {
          // Check if session already exists in PostgreSQL
          const existsQuery = `
            SELECT id FROM orchestration_sessions 
            WHERE session_id = $1
          `;
          const existing = await client.query(existsQuery, [session.id]);

          if (existing.rows.length === 0) {
            // Insert new session
            const insertQuery = `
              INSERT INTO orchestration_sessions (
                session_id, user_id, tenant_id, status, config, metadata, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            
            const config = {
              initial_prompt: session.initial_prompt,
              stage: session.stage,
              queen_analysis: session.queen_analysis,
              research_findings: session.research_findings,
              implementation_plan: session.implementation_plan,
              final_response: session.final_response,
              start_time: session.start_time,
              end_time: session.end_time
            };

            const metadata = JSON.parse(session.metadata || '{}');

            await client.query(insertQuery, [
              session.id,
              'system', // Default user for now
              'visualizehr', // Default tenant
              session.stage === 'complete' ? 'completed' : 'active',
              JSON.stringify(config),
              JSON.stringify(metadata),
              session.start_time,
              session.end_time || new Date().toISOString()
            ]);

            console.log(`✅ Synced session: ${session.id}`);
          } else {
            // Update existing session
            const updateQuery = `
              UPDATE orchestration_sessions 
              SET status = $2, config = $3, metadata = $4, updated_at = $5
              WHERE session_id = $1
            `;
            
            const config = {
              initial_prompt: session.initial_prompt,
              stage: session.stage,
              queen_analysis: session.queen_analysis,
              research_findings: session.research_findings,
              implementation_plan: session.implementation_plan,
              final_response: session.final_response,
              start_time: session.start_time,
              end_time: session.end_time
            };

            await client.query(updateQuery, [
              session.id,
              session.stage === 'complete' ? 'completed' : 'active',
              JSON.stringify(config),
              JSON.stringify(JSON.parse(session.metadata || '{}')),
              new Date().toISOString()
            ]);

            console.log(`🔄 Updated session: ${session.id}`);
          }
        }
      } finally {
        client.release();
      }

      console.log(`✅ Synced ${sqliteSessions.length} orchestration sessions`);
    } catch (error) {
      console.error('❌ Error syncing orchestration sessions:', error);
      throw error;
    }
  }

  /**
   * Generate a stable integer ID from a string ID
   */
  generateIntegerId(stringId) {
    let hash = 0;
    for (let i = 0; i < stringId.length; i++) {
      const char = stringId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Sync agents from SQLite to PostgreSQL
   */
  async syncAgents() {
    console.log('🔄 Syncing agents...');
    
    try {
      // Get all agents from SQLite
      const sqliteAgents = this.sqlite.prepare(`
        SELECT * FROM agents 
        ORDER BY created_at DESC
      `).all();

      if (sqliteAgents.length === 0) {
        console.log('📭 No agents found in SQLite');
        return;
      }

      const client = await this.pgPool.connect();
      try {
        await client.query('SET search_path TO sensumaster_dev, public');

        for (const agent of sqliteAgents) {
          // Generate a stable integer ID from the string ID
          const integerId = this.generateIntegerId(agent.id);
          
          // Check if agent already exists in PostgreSQL
          const existsQuery = `SELECT id FROM agents WHERE id = $1`;
          const existing = await client.query(existsQuery, [integerId]);

          const config = {
            sqlite_id: agent.id, // Store the original SQLite ID
            type: agent.type,
            position: {
              x: agent.position_x,
              y: agent.position_y,
              z: agent.position_z
            },
            color: agent.color,
            energy: agent.energy,
            capabilities: JSON.parse(agent.capabilities || '[]'),
            current_task: agent.current_task,
            memory_size: agent.memory_size
          };

          const metadata = JSON.parse(agent.metadata || '{}');

          if (existing.rows.length === 0) {
            // Insert new agent
            const insertQuery = `
              INSERT INTO agents (
                id, name, type, status, user_id, tenant_id, config, metadata, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;

            await client.query(insertQuery, [
              integerId,
              agent.name,
              agent.type,
              agent.status,
              'system', // Default user
              'visualizehr', // Default tenant
              JSON.stringify(config),
              JSON.stringify(metadata),
              agent.created_at,
              agent.updated_at
            ]);

            console.log(`✅ Synced agent: ${agent.name} (${agent.id} → ${integerId})`);
          } else {
            // Update existing agent
            const updateQuery = `
              UPDATE agents 
              SET name = $2, type = $3, status = $4, config = $5, metadata = $6, updated_at = $7
              WHERE id = $1
            `;

            await client.query(updateQuery, [
              integerId,
              agent.name,
              agent.type,
              agent.status,
              JSON.stringify(config),
              JSON.stringify(metadata),
              agent.updated_at
            ]);

            console.log(`🔄 Updated agent: ${agent.name} (${agent.id} → ${integerId})`);
          }
        }
      } finally {
        client.release();
      }

      console.log(`✅ Synced ${sqliteAgents.length} agents`);
    } catch (error) {
      console.error('❌ Error syncing agents:', error);
      throw error;
    }
  }

  /**
   * Sync tasks/interactions from SQLite to PostgreSQL
   */
  async syncTasks() {
    console.log('🔄 Syncing tasks/interactions...');
    
    try {
      // Get all interactions from SQLite
      const sqliteInteractions = this.sqlite.prepare(`
        SELECT i.*, a.name as agent_name
        FROM interactions i
        LEFT JOIN agents a ON i.agent_id = a.id
        ORDER BY i.timestamp DESC
      `).all();

      if (sqliteInteractions.length === 0) {
        console.log('📭 No interactions found in SQLite');
        return;
      }

      const client = await this.pgPool.connect();
      try {
        await client.query('SET search_path TO sensumaster_dev, public');

        for (const interaction of sqliteInteractions) {
          // Generate a stable integer ID from the string ID
          const integerId = this.generateIntegerId(interaction.id);
          
          // Check if task already exists in PostgreSQL
          const existsQuery = `SELECT id FROM tasks WHERE id = $1`;
          const existing = await client.query(existsQuery, [integerId]);

          if (existing.rows.length === 0) {
            // Generate integer ID for agent
            const agentIntegerId = interaction.agent_id ? this.generateIntegerId(interaction.agent_id) : null;
            
            // Insert new task
            const insertQuery = `
              INSERT INTO tasks (
                id, agent_id, user_id, tenant_id, type, status, input, output, metadata, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;

            const input = {
              type: interaction.type,
              content: interaction.content,
              sqlite_id: interaction.id
            };

            await client.query(insertQuery, [
              integerId,
              agentIntegerId,
              'system', // Default user
              'visualizehr', // Default tenant
              interaction.type,
              'completed', // Interactions are completed tasks
              JSON.stringify(input),
              JSON.stringify({ content: interaction.content }),
              JSON.stringify(JSON.parse(interaction.metadata || '{}')),
              interaction.timestamp,
              interaction.timestamp
            ]);

            console.log(`✅ Synced task: ${interaction.id} → ${integerId}`);
          }
        }
      } finally {
        client.release();
      }

      console.log(`✅ Synced ${sqliteInteractions.length} tasks`);
    } catch (error) {
      console.error('❌ Error syncing tasks:', error);
      throw error;
    }
  }

  /**
   * Sync agent communications from SQLite to PostgreSQL
   */
  async syncCommunications() {
    console.log('🔄 Syncing communications...');
    
    try {
      // Get all interactions for communications
      const sqliteInteractions = this.sqlite.prepare(`
        SELECT i.*, a.name as agent_name
        FROM interactions i
        LEFT JOIN agents a ON i.agent_id = a.id
        WHERE i.type IN ('text_input', 'agent_response')
        ORDER BY i.timestamp DESC
      `).all();

      if (sqliteInteractions.length === 0) {
        console.log('📭 No communications found in SQLite');
        return;
      }

      const client = await this.pgPool.connect();
      try {
        await client.query('SET search_path TO sensumaster_dev, public');

        for (const interaction of sqliteInteractions) {
          // Generate a stable integer ID from the string ID
          const integerId = this.generateIntegerId(interaction.id);
          
          // Check if communication already exists in PostgreSQL
          const existsQuery = `SELECT id FROM agent_communications WHERE id = $1`;
          const existing = await client.query(existsQuery, [integerId]);

          if (existing.rows.length === 0) {
            // Generate integer ID for agent
            const agentIntegerId = interaction.agent_id ? this.generateIntegerId(interaction.agent_id) : null;
            
            // Insert new communication
            const insertQuery = `
              INSERT INTO agent_communications (
                id, agent_id, user_id, tenant_id, type, input, output, metadata, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;

            const input = interaction.type === 'text_input' ? interaction.content : null;
            const output = interaction.type === 'agent_response' ? interaction.content : null;

            await client.query(insertQuery, [
              integerId,
              agentIntegerId,
              'system', // Default user
              'visualizehr', // Default tenant
              interaction.type,
              input ? JSON.stringify({ content: input }) : null,
              output ? JSON.stringify({ content: output }) : null,
              JSON.stringify(JSON.parse(interaction.metadata || '{}')),
              interaction.timestamp
            ]);

            console.log(`✅ Synced communication: ${interaction.id} → ${integerId}`);
          }
        }
      } finally {
        client.release();
      }

      console.log(`✅ Synced ${sqliteInteractions.length} communications`);
    } catch (error) {
      console.error('❌ Error syncing communications:', error);
      throw error;
    }
  }

  /**
   * Run complete data synchronization
   */
  async syncAll() {
    console.log('🚀 Starting complete data synchronization...');
    const startTime = Date.now();

    try {
      await this.syncOrchestrationSessions();
      await this.syncAgents();
      await this.syncTasks();
      await this.syncCommunications();

      const duration = Date.now() - startTime;
      console.log(`✅ Data synchronization completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Data synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.sqlite) {
      this.sqlite.close();
    }
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }
}

export default DataSyncService;

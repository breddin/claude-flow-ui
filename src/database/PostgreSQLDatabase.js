import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class PostgreSQLDatabase {
  constructor() {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sensuresearch',
      user: process.env.DB_USER || 'sensumaster',
      password: process.env.DB_PASSWORD || '',
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '60000'),
    };

    // Set default schema to sensumaster_dev
    if (process.env.DB_SCHEMA) {
      config.options = `--search_path=${process.env.DB_SCHEMA}`;
    }

    // Add SSL configuration for RDS
    if (process.env.DB_SSL_MODE === 'require') {
      config.ssl = {
        rejectUnauthorized: false  // Set to false for RDS with self-signed certs
      };
    }

    // Set default schema search path
    if (process.env.DB_SCHEMA) {
      config.application_name = 'claude-flow-ui';
      config.statement_timeout = 30000;
    }

    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    // Initialize database schema
    this.initializeSchema();
  }

  static getInstance() {
    if (!PostgreSQLDatabase.instance) {
      PostgreSQLDatabase.instance = new PostgreSQLDatabase();
    }
    return PostgreSQLDatabase.instance;
  }

  async initializeSchema() {
    const client = await this.pool.connect();
    try {
      // Set search path to use sensumaster_dev schema
      if (process.env.DB_SCHEMA) {
        await client.query(`SET search_path TO ${process.env.DB_SCHEMA}, public`);
      }

      // Check if we're working with existing Sensu tables
      const hasSensuTables = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'v_user_authentication'
        )
      `, [process.env.DB_SCHEMA || 'public']);

      if (hasSensuTables.rows[0].exists) {
        console.log('✅ Using existing Sensu authentication system');
        // Don't create new tables, use existing Sensu system
        return;
      }

      console.log('⚠️ Sensu tables not found, creating basic tables...');
      
      // Only create basic tables if Sensu system is not available
      // Create users table with authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'agent')),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);

      // Create agents table (enhanced version with PostgreSQL features)
      await client.query(`
        CREATE TABLE IF NOT EXISTS agents (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('queen', 'research', 'implementation')),
          status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'analyzing', 'researching', 'implementing', 'responding', 'complete')),
          position JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
          color VARCHAR(10) DEFAULT '#3B82F6',
          energy INTEGER DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          capabilities JSONB DEFAULT '[]',
          current_task TEXT,
          memory_size INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create memories table with full-text search
      await client.query(`
        CREATE TABLE IF NOT EXISTS memories (
          id VARCHAR(50) PRIMARY KEY,
          agent_id VARCHAR(50) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL CHECK (type IN ('conversation', 'task', 'insight', 'error')),
          content TEXT NOT NULL,
          importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
          tags JSONB DEFAULT '[]',
          related_memories JSONB DEFAULT '[]',
          embedding_vector REAL[],
          search_vector TSVECTOR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 0,
          is_archived BOOLEAN DEFAULT FALSE
        )
      `);

      // Create interactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS interactions (
          id VARCHAR(50) PRIMARY KEY,
          agent_id VARCHAR(50) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL CHECK (type IN ('text_input', 'agent_response', 'system_event', 'tool_use')),
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create orchestration sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS orchestration_sessions (
          id VARCHAR(50) PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          initial_prompt TEXT NOT NULL,
          stage VARCHAR(20) DEFAULT 'analysis' CHECK (stage IN ('analysis', 'research', 'implementation', 'synthesis', 'complete')),
          queen_analysis TEXT,
          research_findings TEXT,
          implementation_plan TEXT,
          final_response TEXT,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Create API keys table
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key_hash VARCHAR(255) NOT NULL,
          key_prefix VARCHAR(10) NOT NULL,
          name VARCHAR(100) NOT NULL,
          permissions JSONB DEFAULT '[]',
          last_used TIMESTAMP,
          expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create audit logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(50),
          details JSONB DEFAULT '{}',
          ip_address INET,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
        CREATE INDEX IF NOT EXISTS idx_agents_type ON agents (type);
        CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents (owner_id);
        CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories (agent_id);
        CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (type);
        CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories (importance DESC);
        CREATE INDEX IF NOT EXISTS idx_memories_search ON memories USING GIN (search_vector);
        CREATE INDEX IF NOT EXISTS idx_interactions_agent_id ON interactions (agent_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions (user_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON orchestration_sessions (user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_stage ON orchestration_sessions (stage);
        CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
      `);

      // Create trigger for updating search vector on memories
      await client.query(`
        CREATE OR REPLACE FUNCTION update_memory_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := to_tsvector('english', NEW.content);
          NEW.updated_at := CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS memory_search_vector_update ON memories;
        CREATE TRIGGER memory_search_vector_update
          BEFORE INSERT OR UPDATE ON memories
          FOR EACH ROW EXECUTE FUNCTION update_memory_search_vector();
      `);

      // Create function for updating timestamps
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Add updated_at triggers
      const tables = ['users', 'agents'];
      for (const table of tables) {
        await client.query(`
          DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
          CREATE TRIGGER update_${table}_updated_at
            BEFORE UPDATE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
      }

      console.log('✅ PostgreSQL database schema initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // User Authentication Methods
  async createUser(userData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, email, role, created_at`,
        [userData.username, userData.email, userData.passwordHash, userData.role || 'user']
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUserByUsername(username) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateLastLogin(userId) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0 WHERE id = $1',
        [userId]
      );
    } finally {
      client.release();
    }
  }

  async incrementFailedLoginAttempts(username) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE users 
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE 
               WHEN failed_login_attempts >= 4 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
               ELSE NULL
             END
         WHERE username = $1`,
        [username]
      );
    } finally {
      client.release();
    }
  }

  // Agent Methods (updated for PostgreSQL)
  async createAgent(agentData, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO agents (id, name, type, status, position, color, energy, capabilities, metadata, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          agentData.id,
          agentData.name,
          agentData.type,
          agentData.status || 'idle',
          JSON.stringify(agentData.position || { x: 0, y: 0, z: 0 }),
          agentData.color || '#3B82F6',
          agentData.energy || 100,
          JSON.stringify(agentData.capabilities || []),
          JSON.stringify(agentData.metadata || {}),
          userId
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getAllAgents(userId) {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM agents ORDER BY created_at';
      let params = [];
      
      if (userId) {
        query = 'SELECT * FROM agents WHERE owner_id = $1 OR owner_id IS NULL ORDER BY created_at';
        params = [userId];
      }
      
      const result = await client.query(query, params);
      return result.rows.map(row => ({
        ...row,
        position: row.position,
        capabilities: row.capabilities,
        metadata: row.metadata
      }));
    } finally {
      client.release();
    }
  }

  // Memory Methods with full-text search
  async addMemory(memoryData, userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO memories (id, agent_id, user_id, type, content, importance, tags, related_memories)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          memoryData.id,
          memoryData.agentId,
          userId,
          memoryData.type,
          memoryData.content,
          memoryData.importance || 5,
          JSON.stringify(memoryData.tags || []),
          JSON.stringify(memoryData.relatedMemories || [])
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async searchMemories(query, userId) {
    const client = await this.pool.connect();
    try {
      let sqlQuery = `
        SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM memories 
        WHERE search_vector @@ plainto_tsquery('english', $1)
        AND is_archived = false
      `;
      let params = [query];
      
      if (userId) {
        sqlQuery += ' AND user_id = $2';
        params.push(userId);
      }
      
      sqlQuery += ' ORDER BY rank DESC, importance DESC LIMIT 50';
      
      const result = await client.query(sqlQuery, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Audit logging
  async logAction(action, userId, details = {}, req) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          action,
          details.resourceType,
          details.resourceId,
          JSON.stringify(details),
          req?.ip,
          req?.get('User-Agent')
        ]
      );
    } finally {
      client.release();
    }
  }

  // Connection management
  async query(text, params) {
    const client = await this.pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  async getClient() {
    return this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }

  // Health check
  async isHealthy() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Statistics
  async getStatistics(userId) {
    const client = await this.pool.connect();
    try {
      let userFilter = '';
      let params = [];
      
      if (userId) {
        userFilter = ' WHERE owner_id = $1 OR owner_id IS NULL';
        params = [userId];
      }

      const [agentCount, memoryCount, interactionCount, sessionCount] = await Promise.all([
        client.query(`SELECT COUNT(*) as count FROM agents${userFilter}`, params),
        client.query(`SELECT COUNT(*) as count FROM memories WHERE is_archived = false${userId ? ' AND user_id = $1' : ''}`, userId ? [userId] : []),
        client.query(`SELECT COUNT(*) as count FROM interactions${userId ? ' WHERE user_id = $1' : ''}`, userId ? [userId] : []),
        client.query(`SELECT COUNT(*) as count FROM orchestration_sessions${userId ? ' WHERE user_id = $1' : ''}`, userId ? [userId] : [])
      ]);

      return {
        agents: parseInt(agentCount.rows[0].count),
        memories: parseInt(memoryCount.rows[0].count),
        interactions: parseInt(interactionCount.rows[0].count),
        sessions: parseInt(sessionCount.rows[0].count)
      };
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const pgDB = PostgreSQLDatabase.getInstance();
export default PostgreSQLDatabase;

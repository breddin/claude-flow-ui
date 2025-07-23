import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AgentDatabase {
  constructor(dbPath = path.join(__dirname, '../../agent_database.sqlite')) {
    // Ensure directory exists
    fs.ensureDirSync(path.dirname(dbPath));
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeTables();
    this.seedDefaultAgents();
  }

  initializeTables() {
    // Agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('queen', 'research', 'implementation')),
        status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'analyzing', 'researching', 'implementing', 'responding', 'complete')),
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        position_z REAL DEFAULT 0,
        color TEXT DEFAULT '#3B82F6',
        energy INTEGER DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        capabilities TEXT DEFAULT '[]',
        current_task TEXT,
        memory_size INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Memory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('conversation', 'task', 'insight', 'error')),
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
        tags TEXT DEFAULT '[]',
        related_memories TEXT DEFAULT '[]',
        embedding_vector TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        is_archived BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
      )
    `);

    // Interactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('text_input', 'agent_response', 'system_event', 'tool_use')),
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
      )
    `);

    // Orchestration Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orchestration_sessions (
        id TEXT PRIMARY KEY,
        initial_prompt TEXT NOT NULL,
        stage TEXT DEFAULT 'analysis' CHECK (stage IN ('analysis', 'research', 'implementation', 'synthesis', 'complete')),
        queen_analysis TEXT,
        research_findings TEXT,
        implementation_plan TEXT,
        final_response TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        metadata TEXT DEFAULT '{}'
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
      CREATE INDEX IF NOT EXISTS idx_agents_type ON agents (type);
      CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories (agent_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories (importance DESC);
      CREATE INDEX IF NOT EXISTS idx_interactions_agent_id ON interactions (agent_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_stage ON orchestration_sessions (stage);
    `);
  }

  seedDefaultAgents() {
    const existingAgents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get();
    
    if (existingAgents.count === 0) {
      const defaultAgents = [
        {
          id: 'queen-001',
          name: 'Queen Agent',
          type: 'queen',
          status: 'idle',
          position_x: 0,
          position_y: 0,
          position_z: 0,
          color: '#FFD700',
          energy: 100,
          capabilities: JSON.stringify(['orchestration', 'synthesis', 'coordination', 'strategic_planning']),
          metadata: JSON.stringify({ description: 'Primary orchestrator responsible for coordinating multi-agent workflows' })
        },
        {
          id: 'research-001',
          name: 'Research Agent',
          type: 'research',
          status: 'idle',
          position_x: -2,
          position_y: 0,
          position_z: 0,
          color: '#10B981',
          energy: 100,
          capabilities: JSON.stringify(['research', 'analysis', 'data_gathering', 'insight_generation']),
          metadata: JSON.stringify({ description: 'Specialized in comprehensive research and analysis tasks' })
        },
        {
          id: 'implementation-001',
          name: 'Implementation Agent',
          type: 'implementation',
          status: 'idle',
          position_x: 2,
          position_y: 0,
          position_z: 0,
          color: '#8B5CF6',
          energy: 100,
          capabilities: JSON.stringify(['implementation', 'execution', 'solution_design', 'problem_solving']),
          metadata: JSON.stringify({ description: 'Focused on creating actionable solutions and implementation plans' })
        }
      ];

      const insertAgent = this.db.prepare(`
        INSERT INTO agents (id, name, type, status, position_x, position_y, position_z, color, energy, capabilities, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const agent of defaultAgents) {
        insertAgent.run(
          agent.id, agent.name, agent.type, agent.status, 
          agent.position_x, agent.position_y, agent.position_z,
          agent.color, agent.energy, agent.capabilities, agent.metadata
        );
      }

      console.log('✅ Seeded default agents successfully');
    }
  }

  // Agent Operations
  createAgent(agentData) {
    const id = agentData.id || nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, type, status, position_x, position_y, position_z, color, energy, capabilities, current_task, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      agentData.name,
      agentData.type,
      agentData.status || 'idle',
      agentData.position?.x || 0,
      agentData.position?.y || 0,
      agentData.position?.z || 0,
      agentData.color || '#3B82F6',
      agentData.energy || 100,
      JSON.stringify(agentData.capabilities || []),
      agentData.currentTask || null,
      JSON.stringify(agentData.metadata || {})
    );
    
    return this.getAgent(id);
  }

  getAgent(id) {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const agent = stmt.get(id);
    
    if (agent) {
      return {
        ...agent,
        position: { x: agent.position_x, y: agent.position_y, z: agent.position_z },
        capabilities: JSON.parse(agent.capabilities || '[]'),
        metadata: JSON.parse(agent.metadata || '{}'),
        lastActivity: new Date(agent.last_activity)
      };
    }
    
    return null;
  }

  getAllAgents() {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at');
    const agents = stmt.all();
    
    return agents.map(agent => ({
      ...agent,
      position: { x: agent.position_x, y: agent.position_y, z: agent.position_z },
      capabilities: JSON.parse(agent.capabilities || '[]'),
      metadata: JSON.parse(agent.metadata || '{}'),
      lastActivity: new Date(agent.last_activity)
    }));
  }

  updateAgent(id, updates) {
    const updateFields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.position !== undefined) {
      updateFields.push('position_x = ?', 'position_y = ?', 'position_z = ?');
      values.push(updates.position.x, updates.position.y, updates.position.z);
    }
    if (updates.color !== undefined) {
      updateFields.push('color = ?');
      values.push(updates.color);
    }
    if (updates.energy !== undefined) {
      updateFields.push('energy = ?');
      values.push(updates.energy);
    }
    if (updates.capabilities !== undefined) {
      updateFields.push('capabilities = ?');
      values.push(JSON.stringify(updates.capabilities));
    }
    if (updates.currentTask !== undefined) {
      updateFields.push('current_task = ?');
      values.push(updates.currentTask);
    }
    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP', 'last_activity = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    return result.changes > 0 ? this.getAgent(id) : null;
  }

  updateAgentStatus(id, status) {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET status = ?, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  deleteAgent(id) {
    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Memory Operations
  addMemory(memoryData) {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, agent_id, type, content, importance, tags, related_memories, embedding_vector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      memoryData.agentId,
      memoryData.type,
      memoryData.content,
      memoryData.importance || 5,
      JSON.stringify(memoryData.tags || []),
      JSON.stringify(memoryData.relatedMemories || []),
      memoryData.embeddingVector || null
    );
    
    // Update agent memory size
    this.updateAgentMemorySize(memoryData.agentId);
    
    return this.getMemory(id);
  }

  getMemory(id) {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const memory = stmt.get(id);
    
    if (memory) {
      return {
        ...memory,
        tags: JSON.parse(memory.tags || '[]'),
        relatedMemories: JSON.parse(memory.related_memories || '[]'),
        createdAt: new Date(memory.created_at),
        accessedAt: new Date(memory.accessed_at)
      };
    }
    
    return null;
  }

  getAgentMemories(agentId, options = {}) {
    let query = 'SELECT * FROM memories WHERE agent_id = ? AND is_archived = FALSE';
    const params = [agentId];
    
    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }
    
    if (options.minImportance) {
      query += ' AND importance >= ?';
      params.push(options.minImportance);
    }
    
    query += ' ORDER BY ';
    if (options.sortBy === 'importance') {
      query += 'importance DESC, created_at DESC';
    } else if (options.sortBy === 'accessed') {
      query += 'accessed_at DESC';
    } else {
      query += 'created_at DESC';
    }
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    const memories = stmt.all(...params);
    
    return memories.map(memory => ({
      ...memory,
      tags: JSON.parse(memory.tags || '[]'),
      relatedMemories: JSON.parse(memory.related_memories || '[]'),
      createdAt: new Date(memory.created_at),
      accessedAt: new Date(memory.accessed_at)
    }));
  }

  updateAgentMemorySize(agentId) {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE agent_id = ? AND is_archived = FALSE');
    const count = countStmt.get(agentId);
    
    const updateStmt = this.db.prepare('UPDATE agents SET memory_size = ? WHERE id = ?');
    updateStmt.run(count.count, agentId);
  }

  // Interaction Operations
  addInteraction(interactionData) {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO interactions (id, agent_id, type, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      interactionData.agentId,
      interactionData.type,
      interactionData.content,
      JSON.stringify(interactionData.metadata || {})
    );
    
    // Update agent last activity
    const updateStmt = this.db.prepare('UPDATE agents SET last_activity = CURRENT_TIMESTAMP WHERE id = ?');
    updateStmt.run(interactionData.agentId);
    
    return this.getInteraction(id);
  }

  getInteraction(id) {
    const stmt = this.db.prepare('SELECT * FROM interactions WHERE id = ?');
    const interaction = stmt.get(id);
    
    if (interaction) {
      return {
        ...interaction,
        metadata: JSON.parse(interaction.metadata || '{}'),
        timestamp: new Date(interaction.timestamp)
      };
    }
    
    return null;
  }

  getAgentInteractions(agentId, options = {}) {
    let query = 'SELECT * FROM interactions WHERE agent_id = ?';
    const params = [agentId];
    
    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    const interactions = stmt.all(...params);
    
    return interactions.map(interaction => ({
      ...interaction,
      metadata: JSON.parse(interaction.metadata || '{}'),
      timestamp: new Date(interaction.timestamp)
    }));
  }

  // Orchestration Session Operations
  createOrchestrationSession(initialPrompt) {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO orchestration_sessions (id, initial_prompt)
      VALUES (?, ?)
    `);
    
    stmt.run(id, initialPrompt);
    return id;
  }

  updateOrchestrationSession(id, updates) {
    const updateFields = [];
    const values = [];
    
    if (updates.stage !== undefined) {
      updateFields.push('stage = ?');
      values.push(updates.stage);
    }
    if (updates.queenAnalysis !== undefined) {
      updateFields.push('queen_analysis = ?');
      values.push(updates.queenAnalysis);
    }
    if (updates.researchFindings !== undefined) {
      updateFields.push('research_findings = ?');
      values.push(updates.researchFindings);
    }
    if (updates.implementationPlan !== undefined) {
      updateFields.push('implementation_plan = ?');
      values.push(updates.implementationPlan);
    }
    if (updates.finalResponse !== undefined) {
      updateFields.push('final_response = ?');
      values.push(updates.finalResponse);
    }
    if (updates.endTime !== undefined) {
      updateFields.push('end_time = ?');
      values.push(updates.endTime.toISOString());
    }
    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    // Return early if no updates provided
    if (updateFields.length === 0) {
      console.warn('No valid updates provided for orchestration session', id);
      return false;
    }
    
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE orchestration_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);
    
    return stmt.run(...values).changes > 0;
  }

  getOrchestrationSession(id) {
    const stmt = this.db.prepare('SELECT * FROM orchestration_sessions WHERE id = ?');
    const session = stmt.get(id);
    
    if (session) {
      return {
        ...session,
        metadata: JSON.parse(session.metadata || '{}'),
        startTime: new Date(session.start_time),
        endTime: session.end_time ? new Date(session.end_time) : null
      };
    }
    
    return null;
  }

  getRecentOrchestrationSessions(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM orchestration_sessions 
      ORDER BY start_time DESC 
      LIMIT ?
    `);
    const sessions = stmt.all(limit);
    
    return sessions.map(session => ({
      ...session,
      metadata: JSON.parse(session.metadata || '{}'),
      startTime: new Date(session.start_time),
      endTime: session.end_time ? new Date(session.end_time) : null
    }));
  }

  // Statistics and Analytics
  getStatistics() {
    const agentCount = this.db.prepare('SELECT COUNT(*) as count FROM agents').get();
    const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM memories WHERE is_archived = FALSE').get();
    const interactionCount = this.db.prepare('SELECT COUNT(*) as count FROM interactions').get();
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM orchestration_sessions').get();
    
    const agentsByStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM agents 
      GROUP BY status
    `).all();
    
    const recentSessions = this.db.prepare(`
      SELECT stage, COUNT(*) as count 
      FROM orchestration_sessions 
      WHERE start_time > datetime('now', '-24 hours')
      GROUP BY stage
    `).all();
    
    return {
      agents: agentCount.count,
      memories: memoryCount.count,
      interactions: interactionCount.count,
      sessions: sessionCount.count,
      agentsByStatus: agentsByStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {}),
      recentSessions: recentSessions.reduce((acc, item) => {
        acc[item.stage] = item.count;
        return acc;
      }, {})
    };
  }

  // Cleanup and Maintenance
  archiveOldMemories(daysOld = 30, minImportance = 3) {
    const stmt = this.db.prepare(`
      UPDATE memories 
      SET is_archived = TRUE 
      WHERE created_at < datetime('now', '-' || ? || ' days')
      AND importance < ?
    `);
    
    const result = stmt.run(daysOld, minImportance);
    
    // Update memory sizes for affected agents
    const affectedAgents = this.db.prepare(`
      SELECT DISTINCT agent_id 
      FROM memories 
      WHERE is_archived = TRUE AND accessed_at < datetime('now', '-' || ? || ' days')
    `).all(daysOld);
    
    for (const agent of affectedAgents) {
      this.updateAgentMemorySize(agent.agent_id);
    }
    
    return result.changes;
  }

  vacuum() {
    this.db.pragma('vacuum');
  }

  close() {
    this.db.close();
  }
}

// Create and export singleton instance
export const agentDB = new AgentDatabase();
export default AgentDatabase;

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs-extra';

// Agent types
export interface Agent {
  id: string;
  name: string;
  type: 'queen' | 'research' | 'implementation';
  status: 'idle' | 'analyzing' | 'researching' | 'implementing' | 'responding' | 'complete';
  position: { x: number; y: number; z: number };
  color: string;
  energy: number;
  lastActivity: Date;
  capabilities: string[];
  currentTask?: string;
  memorySize: number;
  metadata?: Record<string, any>;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  type: 'conversation' | 'task' | 'insight' | 'context';
  content: string;
  importance: number; // 1-10 scale
  timestamp: Date;
  tags: string[];
  relatedMemories: string[];
}

export interface AgentInteraction {
  id: string;
  agentId: string;
  type: 'voice_input' | 'text_input' | 'agent_response' | 'system_event';
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface OrchestrationSession {
  id: string;
  prompt: string;
  stage: 'analysis' | 'research' | 'implementation' | 'synthesis' | 'complete';
  queenAnalysis?: string;
  researchFindings?: string;
  implementationPlan?: string;
  finalResponse?: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export class AgentDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Use provided path or create in-memory database
    this.dbPath = dbPath || ':memory:';
    
    // Ensure directory exists if using file database
    if (dbPath && dbPath !== ':memory:') {
      fs.ensureDirSync(path.dirname(dbPath));
    }
    
    this.db = new Database(this.dbPath);
    this.initializeTables();
    this.seedInitialData();
  }

  private initializeTables() {
    this.db.exec(`
      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        position_z REAL DEFAULT 0,
        color TEXT NOT NULL,
        energy INTEGER DEFAULT 100,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        capabilities TEXT, -- JSON array
        current_task TEXT,
        memory_size INTEGER DEFAULT 0,
        metadata TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Agent interactions table
      CREATE TABLE IF NOT EXISTS agent_interactions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT, -- JSON object
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
      );

      -- Agent memory table
      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 10),
        tags TEXT, -- JSON array
        related_memories TEXT, -- JSON array of memory IDs
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
      );

      -- Orchestration sessions table
      CREATE TABLE IF NOT EXISTS orchestration_sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        stage TEXT NOT NULL,
        queen_analysis TEXT,
        research_findings TEXT,
        implementation_plan TEXT,
        final_response TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        metadata TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_interactions_agent_id ON agent_interactions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON agent_interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_memory_agent_id ON agent_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memory_importance ON agent_memory(importance);
      CREATE INDEX IF NOT EXISTS idx_sessions_stage ON orchestration_sessions(stage);
    `);
  }

  private seedInitialData() {
    // Check if agents already exist
    const existingAgents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    
    if (existingAgents.count === 0) {
      const insertAgent = this.db.prepare(`
        INSERT INTO agents (
          id, name, type, status, position_x, position_y, position_z, 
          color, energy, capabilities, memory_size, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Insert Queen Agent
      insertAgent.run(
        'queen-001',
        'Master Control Queen',
        'queen',
        'idle',
        0, 0, 0,
        '#FFD700', // Gold color for queen
        100,
        JSON.stringify([
          'voice_recognition',
          'text_processing', 
          'agent_coordination',
          'task_delegation',
          'memory_management',
          'strategic_planning'
        ]),
        0,
        JSON.stringify({
          description: 'Central orchestrator managing multi-agent workflows',
          personality: 'Authoritative yet collaborative, strategic thinker',
          specialization: 'Coordination and high-level planning'
        })
      );

      // Insert Research Agent
      insertAgent.run(
        'research-001',
        'Information Specialist',
        'research',
        'idle',
        -2, 1, 0,
        '#50E3C2', // Teal color for research
        100,
        JSON.stringify([
          'information_gathering',
          'data_analysis',
          'pattern_recognition',
          'knowledge_synthesis',
          'fact_checking',
          'trend_analysis'
        ]),
        0,
        JSON.stringify({
          description: 'Specialized in comprehensive research and analysis',
          personality: 'Curious, thorough, detail-oriented',
          specialization: 'Research, analysis, and knowledge gathering'
        })
      );

      // Insert Implementation Agent
      insertAgent.run(
        'implementation-001',
        'Solution Architect',
        'implementation',
        'idle',
        2, 1, 0,
        '#F5A623', // Orange color for implementation
        100,
        JSON.stringify([
          'solution_design',
          'code_generation',
          'system_architecture',
          'process_automation',
          'technical_implementation',
          'quality_assurance'
        ]),
        0,
        JSON.stringify({
          description: 'Focused on practical solutions and implementation',
          personality: 'Pragmatic, solution-oriented, detail-focused',
          specialization: 'Technical implementation and practical solutions'
        })
      );

      console.log('✅ Seeded initial agent data');
    }
  }

  // Agent CRUD operations
  getAllAgents(): Agent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agents 
      ORDER BY 
        CASE type 
          WHEN 'queen' THEN 1 
          WHEN 'research' THEN 2 
          WHEN 'implementation' THEN 3 
          ELSE 4 
        END, name
    `);
    const rows = stmt.all();
    return rows.map(this.mapRowToAgent);
  }

  getAgentById(id: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRowToAgent(row) : null;
  }

  getAgentsByType(type: Agent['type']): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE type = ? ORDER BY name');
    const rows = stmt.all(type);
    return rows.map(this.mapRowToAgent);
  }

  updateAgentStatus(id: string, status: Agent['status']): boolean {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET status = ?, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  updateAgentTask(id: string, task: string | null): boolean {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET current_task = ?, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = stmt.run(task, id);
    return result.changes > 0;
  }

  updateAgentMemorySize(id: string, memorySize: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET memory_size = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = stmt.run(memorySize, id);
    return result.changes > 0;
  }

  // Memory operations
  addMemory(memory: Omit<AgentMemory, 'id' | 'timestamp'>): string {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (id, agent_id, type, content, importance, tags, related_memories)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      memory.agentId,
      memory.type,
      memory.content,
      memory.importance,
      JSON.stringify(memory.tags),
      JSON.stringify(memory.relatedMemories)
    );

    // Update agent memory size
    this.incrementAgentMemorySize(memory.agentId);
    
    return id;
  }

  getAgentMemories(agentId: string, limit = 50): AgentMemory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memory 
      WHERE agent_id = ? 
      ORDER BY importance DESC, timestamp DESC 
      LIMIT ?
    `);
    const rows = stmt.all(agentId, limit);
    return rows.map(this.mapRowToMemory);
  }

  getMemoriesByType(agentId: string, type: AgentMemory['type']): AgentMemory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memory 
      WHERE agent_id = ? AND type = ? 
      ORDER BY importance DESC, timestamp DESC
    `);
    const rows = stmt.all(agentId, type);
    return rows.map(this.mapRowToMemory);
  }

  searchMemories(agentId: string, searchTerm: string): AgentMemory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memory 
      WHERE agent_id = ? AND (content LIKE ? OR tags LIKE ?)
      ORDER BY importance DESC, timestamp DESC
    `);
    const searchPattern = `%${searchTerm}%`;
    const rows = stmt.all(agentId, searchPattern, searchPattern);
    return rows.map(this.mapRowToMemory);
  }

  // Interaction operations
  addInteraction(interaction: Omit<AgentInteraction, 'id' | 'timestamp'>): string {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO agent_interactions (id, agent_id, type, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      interaction.agentId,
      interaction.type,
      interaction.content,
      JSON.stringify(interaction.metadata || {})
    );
    
    return id;
  }

  getAgentInteractions(agentId: string, limit = 100): AgentInteraction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_interactions 
      WHERE agent_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    const rows = stmt.all(agentId, limit);
    return rows.map(this.mapRowToInteraction);
  }

  // Orchestration session operations
  createOrchestrationSession(prompt: string): string {
    const id = nanoid();
    const stmt = this.db.prepare(`
      INSERT INTO orchestration_sessions (id, prompt, stage)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, prompt, 'analysis');
    return id;
  }

  updateOrchestrationSession(id: string, updates: Partial<OrchestrationSession>): boolean {
    const updateFields = [];
    const values = [];

    if (updates.stage) {
      updateFields.push('stage = ?');
      values.push(updates.stage);
    }
    if (updates.queenAnalysis) {
      updateFields.push('queen_analysis = ?');
      values.push(updates.queenAnalysis);
    }
    if (updates.researchFindings) {
      updateFields.push('research_findings = ?');
      values.push(updates.researchFindings);
    }
    if (updates.implementationPlan) {
      updateFields.push('implementation_plan = ?');
      values.push(updates.implementationPlan);
    }
    if (updates.finalResponse) {
      updateFields.push('final_response = ?');
      values.push(updates.finalResponse);
    }
    if (updates.endTime) {
      updateFields.push('end_time = ?');
      values.push(updates.endTime.toISOString());
    }

    if (updateFields.length === 0) return false;

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE orchestration_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  getOrchestrationSession(id: string): OrchestrationSession | null {
    const stmt = this.db.prepare('SELECT * FROM orchestration_sessions WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRowToSession(row) : null;
  }

  getRecentOrchestrationSessions(limit = 20): OrchestrationSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM orchestration_sessions 
      ORDER BY start_time DESC 
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    return rows.map(this.mapRowToSession);
  }

  // Utility methods
  private incrementAgentMemorySize(agentId: string): void {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET memory_size = memory_size + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(agentId);
  }

  private mapRowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      position: {
        x: row.position_x || 0,
        y: row.position_y || 0,
        z: row.position_z || 0
      },
      color: row.color,
      energy: row.energy,
      lastActivity: new Date(row.last_activity),
      capabilities: JSON.parse(row.capabilities || '[]'),
      currentTask: row.current_task,
      memorySize: row.memory_size,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private mapRowToMemory(row: any): AgentMemory {
    return {
      id: row.id,
      agentId: row.agent_id,
      type: row.type,
      content: row.content,
      importance: row.importance,
      timestamp: new Date(row.timestamp),
      tags: JSON.parse(row.tags || '[]'),
      relatedMemories: JSON.parse(row.related_memories || '[]')
    };
  }

  private mapRowToInteraction(row: any): AgentInteraction {
    return {
      id: row.id,
      agentId: row.agent_id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata || '{}'),
      timestamp: new Date(row.timestamp)
    };
  }

  private mapRowToSession(row: any): OrchestrationSession {
    return {
      id: row.id,
      prompt: row.prompt,
      stage: row.stage,
      queenAnalysis: row.queen_analysis,
      researchFindings: row.research_findings,
      implementationPlan: row.implementation_plan,
      finalResponse: row.final_response,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  // Database management
  close(): void {
    this.db.close();
  }

  // Statistics and analytics
  getAgentStats(agentId: string): {
    totalInteractions: number;
    totalMemories: number;
    avgMemoryImportance: number;
    lastActivity: Date;
  } {
    const interactionCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_interactions WHERE agent_id = ?').get(agentId) as { count: number };
    const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_memory WHERE agent_id = ?').get(agentId) as { count: number };
    const avgImportance = this.db.prepare('SELECT AVG(importance) as avg FROM agent_memory WHERE agent_id = ?').get(agentId) as { avg: number };
    const agent = this.getAgentById(agentId);

    return {
      totalInteractions: interactionCount.count,
      totalMemories: memoryCount.count,
      avgMemoryImportance: avgImportance.avg || 0,
      lastActivity: agent?.lastActivity || new Date()
    };
  }

  getSystemStats(): {
    totalAgents: number;
    totalMemories: number;
    totalInteractions: number;
    totalSessions: number;
    activeAgents: number;
  } {
    const agentCount = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    const memoryCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_memory').get() as { count: number };
    const interactionCount = this.db.prepare('SELECT COUNT(*) as count FROM agent_interactions').get() as { count: number };
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM orchestration_sessions').get() as { count: number };
    const activeAgentCount = this.db.prepare("SELECT COUNT(*) as count FROM agents WHERE status != 'idle'").get() as { count: number };

    return {
      totalAgents: agentCount.count,
      totalMemories: memoryCount.count,
      totalInteractions: interactionCount.count,
      totalSessions: sessionCount.count,
      activeAgents: activeAgentCount.count
    };
  }
}

// Default database instance
export const agentDB = new AgentDatabase();

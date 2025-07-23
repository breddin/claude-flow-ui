# Claude-Flow Project Dependency Analysis & API Migration Plan

## Executive Summary

This document provides a comprehensive analysis of the Claude-Flow project's dependencies, instantiation patterns, and recommendations for migrating from a CLI/file-system-centric architecture to an API-centric approach.

## Current Architecture Overview

Claude-Flow v2.0.0 Alpha is built as a multi-runtime, CLI-driven orchestration platform with extensive file-system integration and multiple process spawning patterns.

## Core Dependencies Analysis

### 1. Runtime Dependencies (package.json)

#### **Primary Dependencies**
- **better-sqlite3** (^12.2.0) - SQLite database interface
- **ruv-swarm** (^1.0.14) - External swarm coordination package
- **@modelcontextprotocol/sdk** (^1.0.4) - Model Context Protocol implementation
- **commander** (^11.1.0) - CLI framework
- **inquirer** (^9.2.12) - Interactive CLI prompts
- **express** (^4.18.2) - Web server for HTTP transport
- **ws** (^8.18.3) - WebSocket server/client
- **node-pty** (^1.0.0) - Pseudo-terminal bindings
- **chalk** (^4.1.2) - Terminal colors
- **figlet** (^1.8.1) - ASCII art text
- **blessed** (^0.1.81) - Terminal UI widgets
- **fs-extra** (^11.2.0) - Enhanced file system operations
- **glob** (^11.0.3) - File pattern matching
- **nanoid** (^5.0.4) - Unique ID generation
- **p-queue** (^8.1.0) - Promise queue management
- **cors** (^2.8.5) - Cross-origin resource sharing
- **helmet** (^7.1.0) - Security middleware

#### **Development Dependencies**
- **typescript** (^5.3.3) - Type system
- **@types/** packages - Type definitions
- **jest** (^29.7.0) - Testing framework
- **eslint** (^8.57.1) - Code linting
- **prettier** (^3.1.1) - Code formatting
- **tsx** (^4.6.2) - TypeScript execution

### 2. System Integration Dependencies

#### **SPARC (Structured Problem-solving And Reasoning Capability)**
- **Location**: `/src/cli/commands/sparc.ts`, `.roomodes` config file
- **Instantiation**: CLI command-driven, file-based configuration
- **Type**: Internal framework for AI reasoning modes
- **Usage Pattern**:
  ```typescript
  // Loads JSON configuration from .roomodes file
  const sparcConfig = JSON.parse(content);
  // Executes different reasoning modes (architect, code, tdd, etc.)
  ```

#### **ruv-swarm Integration**
- **Location**: `/src/cli/commands/ruv-swarm.ts`, `/src/mcp/ruv-swarm-tools.ts`
- **Instantiation**: External NPM package, CLI spawning, MCP tools
- **Type**: External coordination library
- **Usage Pattern**:
  ```typescript
  // Check availability and spawn external processes
  const available = await isRuvSwarmAvailable(logger);
  await execAsync('ruv-swarm init');
  ```

#### **SQLite3 (via better-sqlite3)**
- **Location**: `/src/memory/sqlite-wrapper.js`, `/src/hive-mind/core/DatabaseManager.ts`
- **Instantiation**: Database connection with Windows fallback
- **Type**: Embedded database
- **Usage Pattern**:
  ```typescript
  // Dynamic loading with graceful fallback
  const Database = await import('better-sqlite3');
  this.db = new Database(dbPath);
  // Fallback to in-memory store on Windows
  ```

#### **Deno Runtime Support**
- **Location**: `/src/cli/index-remote.ts`, `/src/swarm/coordinator.ts`
- **Instantiation**: Alternative runtime detection and spawning
- **Type**: Alternative JavaScript runtime
- **Usage Pattern**:
  ```typescript
  // Direct Deno API usage for file operations
  await Deno.mkdir(targetDir, { recursive: true });
  const command = new Deno.Command('claude', { args });
  ```

### 3. Process Spawning & External Command Execution

#### **Child Process Management**
- **Location**: `/src/utils/helpers.ts` - `execAsync` function
- **Pattern**: `child_process.exec` promisified
- **Usage**: External command execution (git, npm, claude-cli)

#### **Terminal/PTY Integration**
- **Location**: `node-pty` dependency
- **Pattern**: Pseudo-terminal spawning for interactive processes
- **Usage**: Interactive CLI sessions, background processes

#### **Multi-Runtime Detection**
- **Pattern**: Runtime detection and adaptive execution
- **Supports**: Node.js, Deno, browser environments
- **Location**: `/bin/claude-flow` shell script dispatcher

### 4. MCP (Model Context Protocol) Integration

#### **MCP Server Architecture**
- **Location**: `/src/mcp/server.ts`, `/src/mcp/tools.ts`
- **Instantiation**: HTTP/WebSocket server with tool registry
- **Pattern**: Event-driven protocol server
- **Tools**: 87+ registered MCP tools for AI coordination

#### **Transport Layers**
- **HTTP Transport**: Express.js server with WebSocket upgrade
- **STDIO Transport**: Standard input/output communication
- **Location**: `/src/mcp/transports/`

### 5. File System Dependencies

#### **Configuration Files**
- **CLAUDE.md** - Main project documentation
- **memory-bank.md** - Memory system configuration
- **coordination.md** - Agent coordination rules
- **.roomodes** - SPARC mode configurations
- **.hive-mind/config.json** - Hive-mind settings
- **.claude/settings.json** - Claude Code integration

#### **Database Files**
- **.swarm/memory.db** - Main SQLite database
- **.hive-mind/hive.db** - Hive-mind specific database
- **memory/** - Agent-specific memory files

### 6. Neural/ML Dependencies

#### **Current State**: Limited Integration
- **Pattern Recognition**: Basic coordination pattern learning
- **Storage**: SQLite-based pattern storage
- **Processing**: JavaScript-based analysis (no external ML libraries)
- **Location**: Memory management system, hive-mind coordination

**Note**: No traditional ML frameworks (TensorFlow, PyTorch, FANN) are currently integrated.

## Instantiation Patterns Analysis

### 1. CLI-Centric Pattern
```typescript
// Primary entry point
// File: src/cli/main.ts
const cli = new CLI('claude-flow', 'Advanced AI Agent Orchestration System');
setupCommands(cli);
await cli.run();
```

### 2. External Process Spawning
```typescript
// Pattern used throughout for external integrations
const { execAsync } = require('../utils/helpers.js');
await execAsync('ruv-swarm init');
await execAsync('git status');
```

### 3. File-System Configuration Loading
```typescript
// Configuration pattern
const configPath = '.roomodes';
const content = await readFile(configPath, 'utf-8');
const config = JSON.parse(content);
```

### 4. Database Connection with Fallback
```typescript
// SQLite with Windows compatibility
try {
  const Database = await import('better-sqlite3');
  this.db = new Database(dbPath);
} catch (error) {
  // Fallback to in-memory store
  this.memoryStore = new Map();
}
```

### 5. MCP Tool Registration
```typescript
// Dynamic tool registration
const tools = await createClaudeFlowTools(context);
tools.forEach(tool => server.registerTool(tool));
```

## Migration to API-Centric Architecture

### Recommended Migration Strategy

#### Phase 1: Core API Infrastructure
1. **Replace CLI Commands with REST API Endpoints**
   - Transform each CLI command into a REST endpoint
   - Maintain backward compatibility with CLI wrapper

2. **Centralized Configuration Management**
   - Replace file-based config with database/environment variables
   - Implement configuration API endpoints

3. **Database API Layer**
   - Abstract SQLite operations behind API
   - Implement database migration system
   - Add connection pooling and monitoring

#### Phase 2: External Integration APIs
1. **ruv-swarm Integration API**
   - Replace CLI spawning with direct library integration
   - Implement async task queuing system
   - Add webhooks for status updates

2. **SPARC Mode API**
   - Convert .roomodes file to database configuration
   - Implement mode execution via API calls
   - Add real-time mode switching

3. **MCP Protocol Enhancement**
   - Maintain MCP server but add HTTP API layer
   - Implement tool execution via REST endpoints
   - Add tool marketplace/registry API

#### Phase 3: Advanced Features
1. **Real-time Communication**
   - WebSocket-based agent coordination
   - Event streaming for monitoring
   - Live configuration updates

2. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control
   - API key management

3. **Monitoring & Analytics**
   - Metrics API endpoints
   - Real-time dashboards
   - Performance analytics

### Proposed API Structure

#### Core Endpoints
```
POST /api/v1/agents/spawn
GET  /api/v1/agents/{id}/status
POST /api/v1/tasks/create
GET  /api/v1/tasks/{id}
POST /api/v1/swarm/coordinate
GET  /api/v1/memory/query
POST /api/v1/memory/store
GET  /api/v1/sparc/modes
POST /api/v1/sparc/execute
```

#### Configuration Endpoints
```
GET  /api/v1/config
PUT  /api/v1/config
GET  /api/v1/config/sparc
PUT  /api/v1/config/sparc
```

#### Integration Endpoints
```
POST /api/v1/integrations/ruv-swarm/init
GET  /api/v1/integrations/mcp/tools
POST /api/v1/integrations/mcp/execute
```

### Implementation Considerations

#### 1. Dependency Management
- **SQLite**: Keep as embedded database, add connection pooling
- **ruv-swarm**: Integrate as library instead of CLI spawning
- **MCP**: Maintain server, add HTTP API wrapper
- **SPARC**: Move configuration to database, keep execution engine

#### 2. Backward Compatibility
- Maintain CLI interface as API client
- Preserve file-based configuration loading as fallback
- Keep existing MCP protocol for Claude Code integration

#### 3. Performance Optimizations
- Implement caching layer (Redis/in-memory)
- Add request queuing and rate limiting
- Optimize database queries with indexing
- Implement connection pooling for all external services

#### 4. Security Enhancements
- Add input validation and sanitization
- Implement secure credential management
- Add audit logging for all API calls
- Implement proper error handling and logging

### Migration Timeline

#### Week 1: Infrastructure Setup (✅ COMPLETED)
- ✅ Set up Express.js API server with TypeScript support
- ✅ Implement basic CRUD operations for multi-agent entities
- ✅ Add SQLite database with migrations and seeding
- ✅ Multi-agent orchestration system with persistence

#### Week 2: Authentication & Performance (✅ COMPLETED)
- ✅ PostgreSQL RDS integration replacing SQLite
- ✅ JWT-based authentication system with bcrypt
- ✅ User management and role-based access control
- ✅ Rate limiting and API security (Helmet, CORS)
- ✅ Database optimization with connection pooling
- ✅ Audit logging and monitoring system
- ✅ API key management for programmatic access

#### Weeks 3-4: Advanced Features & Monitoring
- Real-time monitoring dashboard with metrics
- Advanced SPARC reasoning system integration
- Performance analytics and optimization
- WebSocket-based real-time communication

#### Weeks 5-6: Integration APIs
- Implement ruv-swarm API integration
- Convert SPARC modes to API-driven execution
- Enhance MCP protocol with HTTP layer

#### Weeks 7-8: Testing & Documentation
- Comprehensive API testing
- Performance optimization
- API documentation and examples

### Benefits of API-Centric Approach

1. **Scalability**: Better resource management and horizontal scaling
2. **Integration**: Easier third-party integration and automation
3. **Monitoring**: Centralized logging and metrics collection
4. **Deployment**: Container-friendly and cloud-native architecture
5. **Development**: Better separation of concerns and testability
6. **User Experience**: Real-time updates and better error handling

### Risks & Mitigation

#### Risks
1. Breaking changes for existing CLI users
2. Increased complexity in deployment
3. Network latency for local operations
4. Additional security surface area

#### Mitigation Strategies
1. Maintain CLI compatibility layer
2. Provide Docker containers and simple deployment options
3. Implement local API server option
4. Comprehensive security testing and monitoring

## React Agent Visualization Implementation Plan

### Project Overview: Agent Orb Visualization System

This plan outlines the implementation of a React-based user interface that visualizes AI agents as interactive orbs, starting with a master control agent (queen) that accepts voice and text input.

### Phase 1: Foundation Setup (Week 1)

#### 1.1 React Application Bootstrap
```bash
# Create React application with TypeScript
npx create-react-app claude-flow-ui --template typescript
cd claude-flow-ui

# Install core dependencies
npm install @types/react @types/react-dom
npm install sqlite3 better-sqlite3
npm install three @react-three/fiber @react-three/drei
npm install framer-motion
npm install socket.io-client
npm install @fortawesome/react-fontawesome @fortawesome/free-solid-svg-icons
npm install react-speech-recognition
# Note: Web Speech API is native to modern browsers - no package needed
```

#### 1.2 Project Structure
```
claude-flow-ui/
├── src/
│   ├── components/
│   │   ├── agents/
│   │   │   ├── AgentOrb.tsx
│   │   │   ├── QueenAgent.tsx
│   │   │   └── AgentNetwork.tsx
│   │   ├── ui/
│   │   │   ├── VoiceInput.tsx
│   │   │   ├── TextInput.tsx
│   │   │   └── ControlPanel.tsx
│   │   └── visualization/
│   │       ├── Scene3D.tsx
│   │       └── OrbitControls.tsx
│   ├── services/
│   │   ├── database/
│   │   │   ├── AgentDB.ts
│   │   │   └── MemoryDB.ts
│   │   ├── api/
│   │   │   ├── AgentAPI.ts
│   │   │   └── ClaudeFlowAPI.ts
│   │   └── websocket/
│   │       └── AgentSocket.ts
│   ├── types/
│   │   ├── Agent.ts
│   │   ├── Memory.ts
│   │   └── speech.d.ts  # Web Speech API declarations
│   ├── hooks/
│   │   ├── useAgents.ts
│   │   ├── useVoiceInput.ts
│   │   └── useDatabase.ts
│   └── utils/
│       ├── agentUtils.ts
│       └── visualUtils.ts
├── public/
└── package.json
```

#### 1.3 TypeScript Declarations for Web Speech API
```typescript
// src/types/speech.d.ts
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  
  abort(): void;
  start(): void;
  stop(): void;
  
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly confidence: number;
  readonly transcript: string;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};
```

#### 1.3 SQLite In-Memory Database Setup
```typescript
// src/services/database/AgentDB.ts
import Database from 'better-sqlite3';

export interface Agent {
  id: string;
  name: string;
  type: 'queen' | 'worker' | 'specialist';
  status: 'idle' | 'active' | 'thinking' | 'speaking';
  position: { x: number; y: number; z: number };
  color: string;
  energy: number;
  lastActivity: Date;
  capabilities: string[];
  currentTask?: string;
  memorySize: number;
}

export class AgentDatabase {
  private db: Database.Database;

  constructor() {
    // In-memory SQLite database
    this.db = new Database(':memory:');
    this.initializeTables();
    this.seedInitialData();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE agents (
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
        memory_size INTEGER DEFAULT 0
      );

      CREATE TABLE agent_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        interaction_type TEXT NOT NULL,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      );

      CREATE TABLE agent_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      );
    `);
  }

  private seedInitialData() {
    // Insert the Queen agent as the master control
    const insertAgent = this.db.prepare(`
      INSERT INTO agents (
        id, name, type, status, position_x, position_y, position_z, 
        color, energy, capabilities, memory_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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
        'memory_management'
      ]),
      0
    );
  }

  getAllAgents(): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY type, name');
    const rows = stmt.all();
    
    return rows.map(this.mapRowToAgent);
  }

  getAgentById(id: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id);
    
    return row ? this.mapRowToAgent(row) : null;
  }

  updateAgentStatus(id: string, status: Agent['status']) {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET status = ?, last_activity = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(status, id);
  }

  updateAgentPosition(id: string, position: { x: number; y: number; z: number }) {
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET position_x = ?, position_y = ?, position_z = ?, last_activity = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(position.x, position.y, position.z, id);
  }

  addAgentInteraction(agentId: string, type: string, content: string) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_interactions (agent_id, interaction_type, content)
      VALUES (?, ?, ?)
    `);
    stmt.run(agentId, type, content);
  }

  private mapRowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      position: {
        x: row.position_x,
        y: row.position_y,
        z: row.position_z
      },
      color: row.color,
      energy: row.energy,
      lastActivity: new Date(row.last_activity),
      capabilities: JSON.parse(row.capabilities || '[]'),
      currentTask: row.current_task,
      memorySize: row.memory_size
    };
  }
}
```

### Phase 2: 3D Visualization Components (Week 2)

#### 2.1 Agent Orb Component
```typescript
// src/components/agents/AgentOrb.tsx
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Text, Html } from '@react-three/drei';
import { Agent } from '../../types/Agent';
import * as THREE from 'three';

interface AgentOrbProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
  onDoubleClick?: (agent: Agent) => void;
}

export const AgentOrb: React.FC<AgentOrbProps> = ({ 
  agent, 
  onClick, 
  onDoubleClick 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);

  // Animation based on agent status
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    switch (agent.status) {
      case 'thinking':
        meshRef.current.rotation.y += delta * 0.5;
        break;
      case 'active':
        meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
        break;
      case 'speaking':
        meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.2);
        break;
      default:
        meshRef.current.rotation.y += delta * 0.1;
    }
  });

  const getOrbSize = () => {
    switch (agent.type) {
      case 'queen': return 2.5;
      case 'specialist': return 1.8;
      case 'worker': return 1.2;
      default: return 1.0;
    }
  };

  const getEnergyColor = () => {
    const energy = agent.energy;
    if (energy > 75) return agent.color;
    if (energy > 50) return '#FFA500'; // Orange
    if (energy > 25) return '#FF6B6B'; // Red
    return '#8B0000'; // Dark red
  };

  return (
    <group 
      position={[agent.position.x, agent.position.y, agent.position.z]}
      onClick={() => onClick?.(agent)}
      onDoubleClick={() => onDoubleClick?.(agent)}
    >
      {/* Main orb */}
      <Sphere
        ref={meshRef}
        args={[getOrbSize(), 32, 32]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={getEnergyColor()}
          emissive={getEnergyColor()}
          emissiveIntensity={hovered ? 0.3 : 0.1}
          transparent
          opacity={agent.energy / 100 * 0.8 + 0.2}
        />
      </Sphere>

      {/* Energy ring for Queen */}
      {agent.type === 'queen' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3, 3.5, 32]} />
          <meshBasicMaterial
            color={getEnergyColor()}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}

      {/* Agent name */}
      <Text
        position={[0, getOrbSize() + 1, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {agent.name}
      </Text>

      {/* Status indicator */}
      <Text
        position={[0, getOrbSize() + 0.5, 0]}
        fontSize={0.3}
        color={agent.status === 'idle' ? '#888' : '#4CAF50'}
        anchorX="center"
        anchorY="middle"
      >
        {agent.status.toUpperCase()}
      </Text>

      {/* Hover information */}
      {hovered && (
        <Html position={[getOrbSize() + 1, 0, 0]}>
          <div className="agent-tooltip">
            <h4>{agent.name}</h4>
            <p>Type: {agent.type}</p>
            <p>Energy: {agent.energy}%</p>
            <p>Status: {agent.status}</p>
            {agent.currentTask && <p>Task: {agent.currentTask}</p>}
            <p>Capabilities: {agent.capabilities.length}</p>
          </div>
        </Html>
      )}
    </group>
  );
};
```

#### 2.2 Queen Agent Component
```typescript
// src/components/agents/QueenAgent.tsx
import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { AgentOrb } from './AgentOrb';
import { VoiceInput } from '../ui/VoiceInput';
import { TextInput } from '../ui/TextInput';
import { Agent } from '../../types/Agent';

interface QueenAgentProps {
  agent: Agent;
  onVoiceInput: (text: string) => void;
  onTextInput: (text: string) => void;
  onSpawnAgent: (type: 'worker' | 'specialist', task: string) => void;
}

export const QueenAgent: React.FC<QueenAgentProps> = ({
  agent,
  onVoiceInput,
  onTextInput,
  onSpawnAgent
}) => {
  const [isListening, setIsListening] = useState(false);
  const [showInputPanel, setShowInputPanel] = useState(false);

  const handleQueenClick = useCallback(() => {
    setShowInputPanel(!showInputPanel);
  }, [showInputPanel]);

  const handleQueenDoubleClick = useCallback(() => {
    setIsListening(!isListening);
  }, [isListening]);

  const handleVoiceInput = useCallback((text: string) => {
    onVoiceInput(text);
    setIsListening(false);
  }, [onVoiceInput]);

  return (
    <>
      <AgentOrb
        agent={{
          ...agent,
          status: isListening ? 'active' : agent.status
        }}
        onClick={handleQueenClick}
        onDoubleClick={handleQueenDoubleClick}
      />

      {/* Crown effect for Queen */}
      <group position={[agent.position.x, agent.position.y + 4, agent.position.z]}>
        {[...Array(8)].map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 8) * Math.PI * 2) * 0.8,
              Math.sin(i * 0.5) * 0.3,
              Math.sin((i / 8) * Math.PI * 2) * 0.8
            ]}
            rotation={[0, (i / 8) * Math.PI * 2, 0]}
          >
            <coneGeometry args={[0.1, 0.5, 4]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.2} />
          </mesh>
        ))}
      </group>

      {/* Input panels */}
      {showInputPanel && (
        <group position={[agent.position.x + 5, agent.position.y, agent.position.z]}>
          <VoiceInput
            isListening={isListening}
            onResult={handleVoiceInput}
            onToggle={() => setIsListening(!isListening)}
          />
          <TextInput
            onSubmit={onTextInput}
            placeholder="Give me a command..."
          />
        </group>
      )}
    </>
  );
};
```

### Phase 3: Input Systems (Week 3)

#### 3.1 Voice Input Component
```typescript
// src/components/ui/VoiceInput.tsx
import React, { useEffect, useState } from 'react';
import { Html } from '@react-three/drei';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface VoiceInputProps {
  isListening: boolean;
  onResult: (text: string) => void;
  onToggle: () => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  isListening,
  onResult,
  onToggle
}) => {
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (interimTranscript) {
          setTranscript(interimTranscript);
        }
        
        if (finalTranscript) {
          onResult(finalTranscript);
          setTranscript('');
        }
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setTranscript(`Error: ${event.error}`);
      };

      recognitionInstance.onend = () => {
        setTranscript('');
      };

      setRecognition(recognitionInstance);
    } else {
      setIsSupported(false);
      console.warn('Web Speech API not supported in this browser');
    }
  }, [onResult]);

  useEffect(() => {
    if (!recognition || !isSupported) return;

    if (isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    } else {
      recognition.stop();
    }
  }, [isListening, recognition, isSupported]);

  if (!isSupported) {
    return (
      <Html position={[0, 2, 0]}>
        <div className="voice-input-panel">
          <div className="voice-error">
            Voice input not supported in this browser.
            Try Chrome, Edge, or Safari.
          </div>
        </div>
      </Html>
    );
  }

  return (
    <Html position={[0, 2, 0]}>
      <div className="voice-input-panel">
        <button
          onClick={onToggle}
          className={`voice-button ${isListening ? 'listening' : ''}`}
          disabled={!isSupported}
        >
          {isListening ? '🎤 Listening...' : '🎤 Click to Speak'}
        </button>
        
        {transcript && (
          <div className="transcript-preview">
            {transcript}
          </div>
        )}
        
        <div className="voice-instructions">
          Double-click Queen to toggle voice input
        </div>
        
        <div className="voice-status">
          Status: {isListening ? 'Listening' : 'Ready'}
        </div>
      </div>
    </Html>
  );
};
```

#### 3.2 Text Input Component
```typescript
// src/components/ui/TextInput.tsx
import React, { useState } from 'react';
import { Html } from '@react-three/drei';

interface TextInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  onSubmit,
  placeholder = "Enter command..."
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <Html position={[0, 0, 0]}>
      <div className="text-input-panel">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="text-input"
            autoFocus
          />
          <button type="submit" className="submit-button">
            Send
          </button>
        </form>
        
        <div className="text-suggestions">
          <button onClick={() => setInput("Spawn a new worker agent")}>
            Spawn Worker
          </button>
          <button onClick={() => setInput("Show system status")}>
            System Status
          </button>
          <button onClick={() => setInput("Run memory consolidation")}>
            Memory Sync
          </button>
        </div>
      </div>
    </Html>
  );
};
```

### Phase 4: Main Application & Scene (Week 4)

#### 4.1 Main 3D Scene
```typescript
// src/components/visualization/Scene3D.tsx
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { AgentNetwork } from '../agents/AgentNetwork';
import { useAgents } from '../../hooks/useAgents';

export const Scene3D: React.FC = () => {
  const {
    agents,
    updateAgentStatus,
    spawnAgent,
    handleVoiceInput,
    handleTextInput
  } = useAgents();

  return (
    <div className="scene-container">
      <Canvas camera={{ position: [10, 10, 10], fov: 60 }}>
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          {/* Environment */}
          <Environment preset="night" />
          
          {/* Grid */}
          <Grid
            position={[0, -5, 0]}
            args={[20, 20]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#404040"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#606060"
          />

          {/* Agent Network */}
          <AgentNetwork
            agents={agents}
            onVoiceInput={handleVoiceInput}
            onTextInput={handleTextInput}
            onSpawnAgent={spawnAgent}
            onUpdateStatus={updateAgentStatus}
          />

          {/* Camera Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="ui-overlay">
        <div className="status-panel">
          <h3>Agent System Status</h3>
          <div className="agent-stats">
            <div>Total Agents: {agents.length}</div>
            <div>Active: {agents.filter(a => a.status === 'active').length}</div>
            <div>Idle: {agents.filter(a => a.status === 'idle').length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 4.2 Agent Network Component
```typescript
// src/components/agents/AgentNetwork.tsx
import React from 'react';
import { QueenAgent } from './QueenAgent';
import { AgentOrb } from './AgentOrb';
import { Agent } from '../../types/Agent';

interface AgentNetworkProps {
  agents: Agent[];
  onVoiceInput: (text: string) => void;
  onTextInput: (text: string) => void;
  onSpawnAgent: (type: 'worker' | 'specialist', task: string) => void;
  onUpdateStatus: (id: string, status: Agent['status']) => void;
}

export const AgentNetwork: React.FC<AgentNetworkProps> = ({
  agents,
  onVoiceInput,
  onTextInput,
  onSpawnAgent,
  onUpdateStatus
}) => {
  const queenAgent = agents.find(agent => agent.type === 'queen');
  const otherAgents = agents.filter(agent => agent.type !== 'queen');

  return (
    <group>
      {/* Queen Agent */}
      {queenAgent && (
        <QueenAgent
          agent={queenAgent}
          onVoiceInput={onVoiceInput}
          onTextInput={onTextInput}
          onSpawnAgent={onSpawnAgent}
        />
      )}

      {/* Other Agents */}
      {otherAgents.map(agent => (
        <AgentOrb
          key={agent.id}
          agent={agent}
          onClick={(agent) => onUpdateStatus(agent.id, 'active')}
          onDoubleClick={(agent) => console.log('Agent details:', agent)}
        />
      ))}

      {/* Connection lines between agents */}
      {queenAgent && otherAgents.map(agent => (
        <line key={`connection-${agent.id}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([
                queenAgent.position.x, queenAgent.position.y, queenAgent.position.z,
                agent.position.x, agent.position.y, agent.position.z
              ])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#333" transparent opacity={0.3} />
        </line>
      ))}
    </group>
  );
};
```

### Phase 5: React Hooks & State Management (Week 5)

#### 5.1 useAgents Hook
```typescript
// src/hooks/useAgents.ts
import { useState, useEffect, useCallback } from 'react';
import { Agent } from '../types/Agent';
import { AgentDatabase } from '../services/database/AgentDB';
import { nanoid } from 'nanoid';

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [database] = useState(() => new AgentDatabase());

  useEffect(() => {
    // Load initial agents from database
    const initialAgents = database.getAllAgents();
    setAgents(initialAgents);
  }, [database]);

  const updateAgentStatus = useCallback((id: string, status: Agent['status']) => {
    database.updateAgentStatus(id, status);
    setAgents(prevAgents =>
      prevAgents.map(agent =>
        agent.id === id ? { ...agent, status, lastActivity: new Date() } : agent
      )
    );
  }, [database]);

  const spawnAgent = useCallback((type: 'worker' | 'specialist', task: string) => {
    const newAgent: Agent = {
      id: nanoid(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${agents.length}`,
      type,
      status: 'idle',
      position: {
        x: (Math.random() - 0.5) * 10,
        y: Math.random() * 2,
        z: (Math.random() - 0.5) * 10
      },
      color: type === 'specialist' ? '#4CAF50' : '#2196F3',
      energy: 100,
      lastActivity: new Date(),
      capabilities: type === 'specialist' 
        ? ['analysis', 'optimization', 'debugging']
        : ['execution', 'monitoring', 'reporting'],
      currentTask: task,
      memorySize: 0
    };

    // Add to database (would need to implement insertAgent method)
    setAgents(prevAgents => [...prevAgents, newAgent]);
    
    // Log the spawn
    database.addAgentInteraction('queen-001', 'spawn_agent', 
      `Spawned ${type} agent for task: ${task}`);
  }, [agents.length, database]);

  const handleVoiceInput = useCallback((text: string) => {
    console.log('Voice input received:', text);
    
    // Update Queen status
    updateAgentStatus('queen-001', 'thinking');
    
    // Log interaction
    database.addAgentInteraction('queen-001', 'voice_input', text);
    
    // Process the input (simplified command parsing)
    if (text.toLowerCase().includes('spawn worker')) {
      spawnAgent('worker', 'General task execution');
    } else if (text.toLowerCase().includes('spawn specialist')) {
      spawnAgent('specialist', 'Analysis and optimization');
    }
    
    // Reset Queen status after processing
    setTimeout(() => updateAgentStatus('queen-001', 'idle'), 2000);
  }, [database, spawnAgent, updateAgentStatus]);

  const handleTextInput = useCallback((text: string) => {
    console.log('Text input received:', text);
    
    // Update Queen status
    updateAgentStatus('queen-001', 'thinking');
    
    // Log interaction
    database.addAgentInteraction('queen-001', 'text_input', text);
    
    // Process commands
    if (text.toLowerCase().includes('spawn')) {
      const isWorker = text.toLowerCase().includes('worker');
      spawnAgent(isWorker ? 'worker' : 'specialist', text);
    }
    
    // Reset Queen status
    setTimeout(() => updateAgentStatus('queen-001', 'idle'), 1500);
  }, [database, spawnAgent, updateAgentStatus]);

  return {
    agents,
    updateAgentStatus,
    spawnAgent,
    handleVoiceInput,
    handleTextInput
  };
};
```

### Phase 6: Styling & Polish (Week 6)

#### 6.1 CSS Styles
```css
/* src/App.css */
.scene-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
  position: relative;
  overflow: hidden;
}

.ui-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  color: white;
  font-family: 'Arial', sans-serif;
}

.status-panel {
  background: rgba(0, 0, 0, 0.7);
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #333;
  backdrop-filter: blur(10px);
}

.agent-stats div {
  margin: 5px 0;
  font-size: 14px;
}

.voice-input-panel {
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  min-width: 250px;
  color: white;
  font-family: Arial, sans-serif;
}

.voice-button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-bottom: 10px;
  transition: background-color 0.3s ease;
}

.voice-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.voice-button.listening {
  background: #f44336;
  animation: pulse 1s infinite;
}

.voice-error {
  background: rgba(244, 67, 54, 0.2);
  color: #ffcdd2;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #f44336;
  text-align: center;
  font-size: 14px;
}

.voice-status {
  font-size: 12px;
  color: #888;
  margin-top: 10px;
  text-align: center;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.transcript-preview {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 5px;
  margin: 10px 0;
  min-height: 40px;
  font-style: italic;
}

.text-input-panel {
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  min-width: 300px;
  color: white;
  margin-top: 20px;
}

.text-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #333;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 16px;
}

.submit-button {
  background: #2196F3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 10px;
  width: 100%;
}

.text-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
}

.text-suggestions button {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid #333;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.agent-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 15px;
  border-radius: 5px;
  border: 1px solid #333;
  font-family: Arial, sans-serif;
  min-width: 200px;
}

.agent-tooltip h4 {
  margin: 0 0 10px 0;
  color: #FFD700;
}

.agent-tooltip p {
  margin: 5px 0;
  font-size: 12px;
}
```

### Implementation Timeline

#### Week 1: Foundation
- ✅ React app setup with TypeScript
- ✅ SQLite in-memory database implementation
- ✅ Basic agent data structures
- ✅ Initial Queen agent seeding

#### Week 2: 3D Visualization
- ✅ Three.js integration with React Three Fiber
- ✅ AgentOrb component with animations
- ✅ QueenAgent component with crown effect
- ✅ Status-based visual feedback

#### Week 3: Input Systems
- ✅ Voice recognition implementation
- ✅ Text input with command suggestions
- ✅ Input validation and processing

#### Week 4: Scene Integration
- ✅ Complete 3D scene setup
- ✅ Agent network visualization
- ✅ Connection lines between agents
- ✅ Camera controls and environment

#### Week 5: State Management
- ✅ React hooks for agent management
- ✅ Database integration
- ✅ Real-time status updates
- ✅ Agent spawning system

#### Week 6: Polish & Enhancement
- ✅ Comprehensive styling
- ✅ Animations and visual effects
- ✅ Error handling and validation
- ✅ Performance optimization

### Next Steps for Integration

1. **API Integration**: Connect to existing Claude-Flow backend
2. **WebSocket Communication**: Real-time agent updates
3. **Memory System Integration**: Connect to AI agent memory system
4. **Advanced Commands**: Implement complex task delegation
5. **Monitoring Dashboard**: Add system metrics and performance monitoring

This implementation provides a solid foundation for visualizing and interacting with AI agents through an intuitive 3D interface, starting with the master control agent (queen) that can accept both voice and text commands.

## Conclusion

The migration from CLI/file-system-centric to API-centric architecture will significantly improve Claude-Flow's scalability, maintainability, and integration capabilities while preserving existing functionality through compatibility layers. The modular nature of the current codebase makes this migration feasible with careful planning and phased implementation.

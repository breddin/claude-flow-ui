# Claude Code SDK Integration Plan

## Phase 1: Core SDK Integration

### Installation
```bash
npm install @anthropic-ai/claude-code
```

### Environment Setup
```bash
# Required environment variables
ANTHROPIC_API_KEY=your_api_key_here

# Optional third-party providers
CLAUDE_CODE_USE_BEDROCK=1  # For AWS Bedrock
CLAUDE_CODE_USE_VERTEX=1   # For Google Vertex AI
```

### Docker Environment Variables
Add to docker-compose.yml:
```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  - NODE_ENV=production
```

## Phase 2: Architecture Integration

### Replace CLI Commands with SDK Calls
Transform existing CLI-based patterns into programmatic SDK calls:

```typescript
// OLD: CLI-based approach
await execAsync('claude -p "Deploy to ECS"');

// NEW: SDK-based approach
import { query } from "@anthropic-ai/claude-code";

const messages = [];
for await (const message of query({
  prompt: "Deploy to ECS using our established patterns",
  options: {
    maxTurns: 5,
    allowedTools: ["Read", "Write", "Bash"],
    systemPrompt: "You are a DevOps expert with access to our deployment memory."
  }
})) {
  messages.push(message);
}
```

### Memory-Enhanced SDK Integration
```typescript
// Integration with existing memory system
class ClaudeFlowAgent {
  async executeWithMemory(prompt: string, context: ProjectContext) {
    // 1. Recall relevant memory
    const memoryContext = await this.memorySystem.recallRelevantKnowledge(prompt);
    
    // 2. Enhance system prompt with memory
    const enhancedSystemPrompt = `
      ${DEFAULT_SYSTEM_PROMPT}
      
      Previous successful patterns for this project:
      ${memoryContext.successfulPatterns}
      
      Known issues and solutions:
      ${memoryContext.knownIssues}
      
      Project-specific configurations:
      ${memoryContext.configurations}
    `;
    
    // 3. Execute with Claude Code SDK
    const messages = [];
    for await (const message of query({
      prompt,
      abortController: new AbortController(),
      options: {
        maxTurns: 10,
        systemPrompt: enhancedSystemPrompt,
        allowedTools: ["Read", "Write", "Bash", "mcp__filesystem__read_file"],
        mcpConfig: "./mcp-servers.json"
      }
    })) {
      messages.push(message);
    }
    
    // 4. Store outcomes in memory
    await this.memorySystem.recordOutcome(prompt, messages);
    
    return messages;
  }
}
```

## Phase 3: MCP Integration Enhancement

### Leverage Existing MCP Tools
Your project already has 87+ MCP tools - integrate them with Claude Code SDK:

```typescript
// mcp-config.json for Claude Code SDK
{
  "mcpServers": {
    "claude-flow": {
      "command": "node",
      "args": ["./src/mcp/server.js"],
      "env": {
        "PROJECT_ROOT": process.cwd()
      }
    },
    "memory-system": {
      "command": "node", 
      "args": ["./src/memory/mcp-server.js"]
    },
    "deployment": {
      "command": "node",
      "args": ["./src/deployment/mcp-server.js"]
    }
  }
}
```

### Custom Permission System
```typescript
// Integrate with existing permission system
const server = new McpServer({
  name: "Claude-Flow Permission System",
  version: "1.0.0",
});

server.tool(
  "memory_permission_check",
  "Check permissions based on memory patterns and project rules",
  {
    tool_name: z.string(),
    input: z.object({}).passthrough(),
    context: z.object({
      project_id: z.string(),
      user_id: z.string(),
      session_id: z.string()
    })
  },
  async ({ tool_name, input, context }) => {
    // Check memory for similar actions and outcomes
    const memoryCheck = await memorySystem.checkPermission(tool_name, input, context);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(memoryCheck.allowed ? {
          behavior: "allow",
          updatedInput: memoryCheck.optimizedInput || input,
          reasoning: memoryCheck.reasoning
        } : {
          behavior: "deny",
          message: memoryCheck.reason
        })
      }]
    };
  }
);
```

## Phase 4: API Endpoints with SDK Backend

### REST API Layer
```typescript
// api/agents.ts
import { query } from "@anthropic-ai/claude-code";

export async function POST(request: Request) {
  const { prompt, sessionId, projectId } = await request.json();
  
  // Resume existing session or start new one
  const messages = [];
  for await (const message of query({
    prompt,
    options: {
      resume: sessionId,
      maxTurns: 5,
      outputFormat: "json",
      mcpConfig: "./config/mcp-servers.json",
      allowedTools: ["mcp__claude-flow__*", "Read", "Write", "Bash"],
      permissionPromptTool: "mcp__permissions__memory_check"
    }
  })) {
    messages.push(message);
  }
  
  return Response.json({ messages, sessionId: messages[0]?.session_id });
}
```

### WebSocket Integration
```typescript
// Real-time agent communication
export class ClaudeFlowWebSocket {
  async handleAgentRequest(ws: WebSocket, data: AgentRequest) {
    for await (const message of query({
      prompt: data.prompt,
      options: {
        outputFormat: "stream-json",
        continue: data.continueSession,
        allowedTools: data.allowedTools || ["Read", "Write", "Bash"]
      }
    })) {
      // Stream responses to UI in real-time
      ws.send(JSON.stringify({
        type: 'agent_response',
        message,
        timestamp: Date.now()
      }));
    }
  }
}
```

## Phase 5: UI Integration

### React Component Integration
```typescript
// components/AgentInterface.tsx
import { useState, useCallback } from 'react';

export function AgentInterface() {
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const sendToAgent = useCallback(async (prompt: string) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          sessionId: currentSessionId,
          projectId: currentProjectId 
        })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, ...data.messages]);
    } finally {
      setIsProcessing(false);
    }
  }, []);
  
  return (
    <div className="agent-interface">
      {/* 3D visualization with agent responses */}
      <AgentVisualization messages={messages} />
      <AgentInput onSubmit={sendToAgent} disabled={isProcessing} />
    </div>
  );
}
```

## Phase 6: Advanced Features

### Session Management
```typescript
// Persistent session management across container restarts
class SessionManager {
  async resumeSession(sessionId: string) {
    // Load session from memory system
    const sessionData = await this.memorySystem.getSession(sessionId);
    
    return query({
      prompt: "Continue where we left off",
      options: {
        resume: sessionId,
        systemPrompt: sessionData.context,
        mcpConfig: "./config/mcp-servers.json"
      }
    });
  }
}
```

### Deployment Pattern Learning
```typescript
// Learn and optimize deployment patterns
class DeploymentLearningAgent {
  async deployWithLearning(environment: string) {
    const deployment = await query({
      prompt: `Deploy to ${environment} using learned patterns`,
      options: {
        systemPrompt: `
          You are a deployment expert with access to historical deployment data.
          Use the most successful patterns for ${environment} deployments.
          If you encounter errors, check memory for previous solutions.
        `,
        allowedTools: ["mcp__deployment__*", "mcp__memory__*", "Bash"],
        maxTurns: 15
      }
    });
    
    // Record success/failure patterns
    await this.memorySystem.recordDeployment(environment, deployment);
    
    return deployment;
  }
}
```

## Migration Benefits

1. **Eliminates CLI Spawning**: Direct SDK calls replace external process spawning
2. **Enhanced Memory Integration**: SDK responses feed directly into memory system
3. **Real-time Streaming**: Stream-json format enables real-time UI updates
4. **Session Persistence**: Resume conversations across container restarts
5. **MCP Tool Integration**: Leverage existing 87+ MCP tools through SDK
6. **Programmatic Control**: Full control over agent behavior and permissions
7. **Cost Tracking**: Built-in usage and cost monitoring
8. **Error Handling**: Structured error responses for better debugging

## Implementation Timeline

- **Week 1**: SDK installation and basic integration
- **Week 2**: Memory system enhancement with SDK
- **Week 3**: API endpoints and WebSocket integration  
- **Week 4**: UI components and real-time features
- **Week 5**: MCP tool integration and permissions
- **Week 6**: Testing, optimization, and deployment patterns

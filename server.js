import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { WebSocketServer } from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import { agentDB } from './src/database/AgentDatabase.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3001;

// WebSocket connection handling
const connectedClients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  connectedClients.add(ws);
  
  // Send current agent statuses on connection
  try {
    const agents = agentDB.getAllAgents();
    const statistics = agentDB.getStatistics();
    
    ws.send(JSON.stringify({
      type: 'initial_state',
      agents,
      statistics
    }));
  } catch (error) {
    console.error('Error sending initial state:', error);
  }

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

// Broadcast function for real-time updates
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.send(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        connectedClients.delete(client);
      }
    }
  });
}

// Extend AgentDatabase methods to include broadcasting
const originalUpdateAgentStatus = agentDB.updateAgentStatus.bind(agentDB);
agentDB.updateAgentStatus = function(agentId, status) {
  const result = originalUpdateAgentStatus(agentId, status);
  
  // Broadcast status update
  broadcastToClients({
    type: 'agent_status_update',
    agentId,
    status,
    timestamp: new Date().toISOString()
  });
  
  return result;
};

const originalAddMemory = agentDB.addMemory.bind(agentDB);
agentDB.addMemory = function(memoryData) {
  const result = originalAddMemory(memoryData);
  
  // Broadcast memory update
  broadcastToClients({
    type: 'memory_added',
    agentId: memoryData.agentId,
    memory: result,
    timestamp: new Date().toISOString()
  });
  
  return result;
};

const originalAddInteraction = agentDB.addInteraction.bind(agentDB);
agentDB.addInteraction = function(interactionData) {
  const result = originalAddInteraction(interactionData);
  
  // Broadcast interaction update
  broadcastToClients({
    type: 'interaction_added',
    agentId: interactionData.agentId,
    interaction: result,
    timestamp: new Date().toISOString()
  });
  
  return result;
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Import routes (convert to ES modules style)
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/api/admin.js';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - redirect to frontend
app.get('/', (req, res) => {
  res.json({
    message: 'VisualizeHR Agentic AI Backend',
    frontend_url: 'http://localhost:3000',
    api_docs: {
      health: '/api/health',
      auth: '/api/auth/*',
      admin: '/api/admin/*',
      agents: '/api/v1/agents',
      claude: '/api/claude',
      multi_agent: '/api/multi-agent'
    },
    timestamp: new Date().toISOString()
  });
});

// Multi-Agent Claude SDK Functions
async function queryAnthropic(prompt, model = 'claude-3-5-sonnet-20241022') {
  try {
    console.log('🤖 queryAnthropic called with prompt length:', prompt.length);
    
    // Check if we have a valid API key for production use
    if (!process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY.includes('your-api-key')) {
      // Return mock response for testing
      console.log('🧪 Using mock response for development/testing');
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // Simulate API delay
      
      if (prompt.includes('Queen Agent')) {
        return `Based on your request, I'll coordinate with our specialized agents to provide comprehensive analysis and implementation guidance. Let me break this down into strategic components and delegate specific research tasks.`;
      } else if (prompt.includes('Research Agent')) {
        return `I've conducted thorough research on this topic. Here are the key findings: Current industry trends show significant developments in this area, with multiple approaches being actively explored. The most promising methodologies include evidence-based strategies and data-driven solutions.`;
      } else if (prompt.includes('Implementation Agent')) {
        return `Here's a practical implementation approach: 1. Start with foundational setup, 2. Implement core functionality incrementally, 3. Test and validate each component, 4. Deploy with monitoring and feedback loops. This ensures robust, scalable solutions.`;
      } else {
        return `Thank you for your query. I've analyzed your request and can provide detailed insights on this topic. The approach involves systematic analysis, strategic planning, and practical implementation steps.`;
      }
    }
    
    console.log('🔑 Making Anthropic API call...');
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    console.log('✅ Anthropic API call completed, response length:', response.content[0].text.length);
    return response.content[0].text;
  } catch (error) {
    console.error('Anthropic API Error:', error);
    
    // Create a more detailed error object with specific messaging
    const errorDetails = {
      type: 'api_error',
      originalError: error.message || 'Unknown error'
    };
    
    // Handle specific Anthropic API errors
    if (error.status === 401) {
      errorDetails.message = 'Authentication failed - Invalid API key';
      errorDetails.userMessage = 'The Anthropic API key is invalid. Please check your configuration.';
    } else if (error.status === 400 && error.error?.error?.message?.includes('credit balance')) {
      errorDetails.message = 'Insufficient credits';
      errorDetails.userMessage = 'Your Anthropic account has insufficient credits. Please add credits at https://console.anthropic.com/';
    } else if (error.status === 429) {
      errorDetails.message = 'Rate limit exceeded';
      errorDetails.userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.status === 400) {
      errorDetails.message = 'Bad request';
      errorDetails.userMessage = error.error?.error?.message || 'Invalid request format.';
    } else if (error.status >= 500) {
      errorDetails.message = 'Server error';
      errorDetails.userMessage = 'Anthropic service is currently unavailable. Please try again later.';
    } else {
      errorDetails.message = 'API error';
      errorDetails.userMessage = error.error?.error?.message || 'An unexpected error occurred with the AI service.';
    }
    
    // Fall back to mock response but include error info
    console.log('🧪 Falling back to mock response due to API error');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Throw the enhanced error so calling functions can handle it appropriately
    throw errorDetails;
  }
}

async function queryQueenAgent(prompt, context = '') {
  const enhancedPrompt = `You are the Queen Agent - the orchestrator of a multi-agent AI system. You coordinate between Research and Implementation agents to provide comprehensive solutions.

${context ? `Context from previous agents: ${context}` : ''}

User command: "${prompt}"

Your role: Analyze the request, decide what research is needed, and coordinate the final implementation. Be authoritative yet helpful as the lead agent.`;

  return queryAnthropic(enhancedPrompt);
}

async function queryResearchAgent(prompt, queenAnalysis) {
  const researchPrompt = `You are the Research Agent - a specialized AI focused on gathering information, analyzing requirements, and providing detailed research findings.

Queen Agent's Analysis: "${queenAnalysis}"
Original Request: "${prompt}"

Your mission: Conduct thorough research on this topic. Provide detailed findings, best practices, relevant technologies, potential approaches, and any important considerations. Focus on gathering comprehensive information that will inform implementation decisions.`;

  return queryAnthropic(researchPrompt);
}

async function queryImplementationAgent(prompt, queenAnalysis, researchFindings) {
  const implementationPrompt = `You are the Implementation Agent - a specialized AI focused on creating actionable solutions, code, and step-by-step implementation plans.

Queen Agent's Analysis: "${queenAnalysis}"
Research Agent's Findings: "${researchFindings}"
Original Request: "${prompt}"

Your mission: Create a detailed implementation plan based on the research findings. Provide specific steps, code examples if applicable, configurations, and actionable guidance. Focus on practical execution and real-world application.`;

  return queryAnthropic(implementationPrompt);
}

// ===================
// DATABASE API ROUTES
// ===================

// Agent Management APIs
app.get('/api/v1/agents', (req, res) => {
  try {
    const agents = agentDB.getAllAgents();
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents',
      details: error.message
    });
  }
});

app.get('/api/v1/agents/:id', (req, res) => {
  try {
    const agent = agentDB.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent',
      details: error.message
    });
  }
});

app.put('/api/v1/agents/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const success = agentDB.updateAgentStatus(req.params.id, status);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Add interaction record
    agentDB.addInteraction({
      agentId: req.params.id,
      type: 'system_event',
      content: `Status updated to: ${status}`,
      metadata: { previousStatus: status }
    });

    res.json({
      success: true,
      message: 'Agent status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update agent status',
      details: error.message
    });
  }
});

app.get('/api/v1/agents/:id/stats', (req, res) => {
  try {
    const stats = agentDB.getAgentStats(req.params.id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent stats',
      details: error.message
    });
  }
});

// Memory Management APIs
app.post('/api/v1/memory', (req, res) => {
  try {
    const { agentId, type, content, importance = 5, tags = [], relatedMemories = [] } = req.body;
    
    if (!agentId || !type || !content) {
      return res.status(400).json({
        success: false,
        error: 'agentId, type, and content are required'
      });
    }

    const memoryId = agentDB.addMemory({
      agentId,
      type,
      content,
      importance,
      tags,
      relatedMemories
    });

    res.status(201).json({
      success: true,
      data: { id: memoryId },
      message: 'Memory added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add memory',
      details: error.message
    });
  }
});

app.get('/api/v1/memory/:agentId', (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    let memories;

    if (type) {
      memories = agentDB.getMemoriesByType(req.params.agentId, type);
    } else {
      memories = agentDB.getAgentMemories(req.params.agentId, parseInt(limit));
    }

    res.json({
      success: true,
      data: memories,
      count: memories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch memories',
      details: error.message
    });
  }
});

app.get('/api/v1/memory/:agentId/search', (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term (q) is required'
      });
    }

    const memories = agentDB.searchMemories(req.params.agentId, searchTerm);
    res.json({
      success: true,
      data: memories,
      count: memories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search memories',
      details: error.message
    });
  }
});

// Interaction Management APIs
app.post('/api/v1/interactions', (req, res) => {
  try {
    const { agentId, type, content, metadata = {} } = req.body;
    
    if (!agentId || !type || !content) {
      return res.status(400).json({
        success: false,
        error: 'agentId, type, and content are required'
      });
    }

    const interactionId = agentDB.addInteraction({
      agentId,
      type,
      content,
      metadata
    });

    res.status(201).json({
      success: true,
      data: { id: interactionId },
      message: 'Interaction recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to record interaction',
      details: error.message
    });
  }
});

app.get('/api/v1/interactions/:agentId', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const interactions = agentDB.getAgentInteractions(req.params.agentId, parseInt(limit));
    
    res.json({
      success: true,
      data: interactions,
      count: interactions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interactions',
      details: error.message
    });
  }
});

// Orchestration Session APIs
app.post('/api/v1/sessions', (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const sessionId = agentDB.createOrchestrationSession(prompt);
    res.status(201).json({
      success: true,
      data: { id: sessionId },
      message: 'Orchestration session created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      details: error.message
    });
  }
});

app.get('/api/v1/sessions/:id', (req, res) => {
  try {
    const session = agentDB.getOrchestrationSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session',
      details: error.message
    });
  }
});

app.get('/api/v1/sessions', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const sessions = agentDB.getRecentOrchestrationSessions(parseInt(limit));
    
    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      details: error.message
    });
  }
});

app.put('/api/v1/sessions/:id', (req, res) => {
  try {
    const updates = req.body;
    const success = agentDB.updateOrchestrationSession(req.params.id, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
      details: error.message
    });
  }
});

// System Stats API
app.get('/api/v1/stats', (req, res) => {
  try {
    const stats = agentDB.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system stats',
      details: error.message
    });
  }
});

// ========================
// ORCHESTRATION ENDPOINTS
// ========================

// Multi-Agent Orchestration Endpoint with Database Integration
app.post('/api/multi-agent', async (req, res) => {
  let sessionId = null;
  try {
    console.log('🎯 Multi-agent endpoint called');
    const { prompt } = req.body;

    if (!prompt) {
      console.log('❌ No prompt provided');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('🔥 Multi-Agent Orchestration Started:', prompt);
    console.log('📝 Setting up SSE headers...');

    // Create orchestration session
    sessionId = agentDB.createOrchestrationSession(prompt);
    console.log('📊 Session created:', sessionId);

    // Record initial interaction
    agentDB.addInteraction({
      agentId: 'queen-001',
      type: 'text_input',
      content: prompt,
      metadata: { sessionId }
    });
    console.log('📋 Initial interaction recorded');

    // Set up Server-Sent Events for streaming
    console.log('🔄 Setting up SSE response...');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    console.log('✅ SSE headers set');

    // Send initial status
    console.log('📤 Sending initial status...');
    res.write(`data: ${JSON.stringify({ 
      type: 'agent_status', 
      agent: 'queen',
      status: 'analyzing',
      message: 'Queen Agent analyzing request and planning orchestration...',
      sessionId
    })}\n\n`);
    console.log('✅ Initial status sent');

    // Update agent statuses
    agentDB.updateAgentStatus('queen-001', 'analyzing');
    console.log('🤖 Agent status updated to analyzing');

    // Stage 1: Queen Agent Initial Analysis
    try {
      console.log('🔍 Starting Queen Agent analysis...');
      const queenAnalysis = await queryQueenAgent(prompt);
      console.log('✅ Queen Agent analysis completed:', queenAnalysis.substring(0, 100) + '...');
      
      res.write(`data: ${JSON.stringify({ 
        type: 'agent_response', 
        agent: 'queen',
        content: queenAnalysis,
        stage: 'analysis'
      })}\n\n`);

      // Store Queen's analysis
      agentDB.updateOrchestrationSession(sessionId, { 
        stage: 'research', 
        queenAnalysis 
      });
      agentDB.addMemory({
        agentId: 'queen-001',
        type: 'task',
        content: `Initial analysis: ${queenAnalysis.substring(0, 500)}...`,
        importance: 8,
        tags: ['orchestration', 'analysis'],
        relatedMemories: []
      });

      // Stage 2: Research Agent
      console.log('🔍 Starting Research Agent...');
      res.write(`data: ${JSON.stringify({ 
        type: 'agent_status', 
        agent: 'research',
        status: 'researching',
        message: 'Research Agent conducting comprehensive analysis...'
      })}\n\n`);

      agentDB.updateAgentStatus('research-001', 'researching');

      const researchFindings = await queryResearchAgent(prompt, queenAnalysis);
      console.log('✅ Research Agent completed:', researchFindings.substring(0, 100) + '...');
      
      res.write(`data: ${JSON.stringify({ 
        type: 'agent_response', 
        agent: 'research',
        content: researchFindings,
        stage: 'research'
      })}\n\n`);

      // Store Research findings
      agentDB.updateOrchestrationSession(sessionId, { 
        stage: 'implementation', 
        researchFindings 
      });
      agentDB.addMemory({
        agentId: 'research-001',
        type: 'insight',
        content: `Research findings: ${researchFindings.substring(0, 500)}...`,
        importance: 8,
        tags: ['research', 'findings'],
        relatedMemories: []
      });

      // Stage 3: Implementation Agent
      console.log('🔍 Starting Implementation Agent...');
      res.write(`data: ${JSON.stringify({ 
        type: 'agent_status', 
        agent: 'implementation',
        status: 'implementing',
        message: 'Implementation Agent creating detailed execution plan...'
      })}\n\n`);

      agentDB.updateAgentStatus('implementation-001', 'implementing');

      const implementationPlan = await queryImplementationAgent(prompt, queenAnalysis, researchFindings);
      console.log('✅ Implementation Agent completed:', implementationPlan.substring(0, 100) + '...');
      
      res.write(`data: ${JSON.stringify({ 
        type: 'agent_response', 
        agent: 'implementation',
        content: implementationPlan,
        stage: 'implementation'
      })}\n\n`);

      // Store Implementation plan
      agentDB.updateOrchestrationSession(sessionId, { 
        stage: 'complete', 
        implementationPlan,
        status: 'complete'
      });
      agentDB.addMemory({
        agentId: 'implementation-001',
        type: 'insight',
        content: `Implementation plan: ${implementationPlan.substring(0, 500)}...`,
        importance: 9,
        tags: ['implementation', 'plan'],
        relatedMemories: []
      });

      // Update all agent statuses to completed
      agentDB.updateAgentStatus('queen-001', 'complete');
      agentDB.updateAgentStatus('research-001', 'complete');
      agentDB.updateAgentStatus('implementation-001', 'complete');

      console.log('✅ All agents completed, sending orchestration_complete...');
      
      // Send completion status
      res.write(`data: ${JSON.stringify({ 
        type: 'orchestration_complete',
        message: 'Multi-agent orchestration completed successfully.',
        sessionId,
        stages: {
          analysis: queenAnalysis,
          research: researchFindings,
          implementation: implementationPlan
        }
      })}\n\n`);

      console.log('✅ Orchestration complete event sent');
      res.end();

    } catch (apiError) {
      // Handle specific API errors with detailed messaging
      console.error('🚨 API Error during multi-agent orchestration:', apiError);
      
      const errorMessage = apiError.type === 'api_error' ? 
        apiError.userMessage : 
        'An unexpected error occurred during multi-agent orchestration.';
      
      if (sessionId) {
        try {
          agentDB.updateOrchestrationSession(sessionId, { 
            status: 'failed',
            error: errorMessage 
          });
        } catch (dbError) {
          console.error('🚨 Database error while updating session:', dbError);
        }
      }
      
      try {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error',
            message: errorMessage,
            details: apiError.originalError || apiError.message
          })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ 
            error: 'Multi-agent orchestration failed', 
            message: errorMessage,
            details: apiError.originalError || apiError.message
          });
        }
      } catch (resError) {
        console.error('🚨 Error sending error response:', resError);
      }
      return;
    }

  } catch (error) {
    console.error('Multi-Agent Orchestration Error:', error);
    
    // Handle specific API errors with detailed messaging
    const errorMessage = error.type === 'api_error' ? 
      error.userMessage : 
      'An unexpected error occurred during multi-agent orchestration.';
    
    if (sessionId) {
      agentDB.updateOrchestrationSession(sessionId, { 
        status: 'failed',
        error: errorMessage 
      });
    }
    
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        message: errorMessage,
        details: error.originalError || error.message
      })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ 
        error: 'Multi-agent orchestration failed', 
        message: errorMessage,
        details: error.originalError || error.message
      });
    }
  }
});

// Original single-agent endpoint (for compatibility)
app.post('/api/claude', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Received prompt:', prompt);

    // Create the enhanced prompt for Queen Agent
    const enhancedPrompt = `You are a Queen Agent AI assistant with access to enterprise tools and memory systems. You manage and orchestrate AI operations with sophisticated decision-making capabilities.

User command: "${prompt}"

Please provide a helpful response as the Queen Agent. Be concise but informative, and maintain the persona of a sophisticated AI agent managing systems and operations. Respond in a professional yet approachable tone.`;

    // Set up Server-Sent Events for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      // Use SDK approach with unattended authentication
      const response = await queryAnthropic(enhancedPrompt);
      
      // Send the complete response
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        content: response || 'I processed your request successfully.' 
      })}\n\n`);
      
    } catch (apiError) {
      console.error('SDK API Error:', apiError);
      
      const errorMessage = apiError.type === 'api_error' ? 
        apiError.userMessage : 
        'Unable to process request with Claude API';
      
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: errorMessage,
        details: apiError.originalError || apiError.message
      })}\n\n`);
    }
    
    res.end();

  } catch (error) {
    console.error('Claude API Error:', error);
    
    const errorMessage = error.type === 'api_error' ? 
      error.userMessage : 
      'Failed to process request';
    
    res.status(500).json({ 
      error: 'Failed to process request', 
      message: errorMessage,
      details: error.originalError || error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`🚀 Claude Flow UI Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api/claude`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`📊 Database initialized with ${agentDB.getAllAgents().length} agents`);
});

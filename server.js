import express from 'express';
import cors from 'cors';
import { query } from '@anthropic-ai/claude-code';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Claude API endpoint
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

    // Query Claude SDK
    const response = query({
      prompt: enhancedPrompt,
      options: {
        model: 'claude-3-5-sonnet-20241022'
      }
    });

    let fullResponse = '';
    let hasStartedStreaming = false;

    // Set up Server-Sent Events for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    for await (const message of response) {
      if (message.type === 'assistant' && message.message.content) {
        hasStartedStreaming = true;
        for (const content of message.message.content) {
          if (content.type === 'text') {
            fullResponse += content.text;
            // Send incremental updates
            res.write(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: content.text 
            })}\n\n`);
          }
        }
      } else if (message.type === 'result' && message.subtype === 'success') {
        fullResponse = message.result || fullResponse;
        res.write(`data: ${JSON.stringify({ 
          type: 'result', 
          content: message.result 
        })}\n\n`);
      } else if (message.type === 'system') {
        res.write(`data: ${JSON.stringify({ 
          type: 'system', 
          content: `Connected to Claude ${message.model}` 
        })}\n\n`);
      }
    }

    // Send final response
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      content: fullResponse || 'I processed your request successfully.' 
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error('Claude API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Claude Flow UI Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api/claude`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

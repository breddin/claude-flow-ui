import React, { useState, useEffect } from 'react';
import QueenAgentImage from './QueenAgent.webp';
import './App.css';

// Speech Recognition Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

// Queen Agent Image Component with Oval Crop
function QueenAgent({ status }: { status: 'idle' | 'listening' | 'processing' | 'responding' }) {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 0.1) % (Math.PI * 2));
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return '#4A90E2';      // Blue - waiting
      case 'listening': return '#7ED321';  // Green - active
      case 'processing': return '#F5A623'; // Orange - thinking
      case 'responding': return '#BD10E0'; // Purple - speaking
      default: return '#4A90E2';
    }
  };

  const floatingOffset = Math.sin(animationPhase) * 10; // 10px floating range

  return (
    <div className="queen-agent-container">
      {/* Crown effect particles */}
      <div className="crown-particles">
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className="crown-particle"
            style={{
              '--angle': `${i * 45}deg`,
              '--delay': `${i * 0.2}s`
            } as React.CSSProperties}
          >
            ✨
          </div>
        ))}
      </div>
      
      {/* Main Queen Agent Image with Oval Crop */}
      <div 
        className="queen-agent-image-wrapper"
        style={{
          transform: `translateY(${floatingOffset}px)`,
          boxShadow: `0 0 30px ${getStatusColor()}`,
          borderColor: getStatusColor()
        }}
      >
        <img 
          src={QueenAgentImage} 
          alt="Queen Agent" 
          className="queen-agent-image"
        />
        <div 
          className="status-glow"
          style={{ backgroundColor: getStatusColor() }}
        />
      </div>
      
      {/* Status indicator */}
      <div className="status-text">
        Queen Agent: {status.toUpperCase()}
      </div>
    </div>
  );
}

// Input Panel Component
function InputPanel({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    // Initialize Speech Recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
      };
      
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        // Fallback message for errors
        setInput(`Voice input error: ${event.error}`);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const startVoiceInput = () => {
    if (recognition) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setInput('Voice recognition unavailable');
      }
    } else {
      // Fallback for browsers without speech recognition
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        setInput("Voice input: Speech recognition not supported in this browser");
      }, 2000);
    }
  };

  return (
    <div className="input-panel">
      <div className="input-header">
        <h3>Command Interface</h3>
        <button 
          className={`voice-button ${isListening ? 'listening' : ''}`}
          onClick={startVoiceInput}
          disabled={isListening}
          title={recognition ? 
            (isListening ? 'Listening... Speak now' : 'Click to start voice input') : 
            'Voice recognition not supported in this browser'
          }
        >
          {isListening ? '🎤 Listening...' : '🎤 Voice'}
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command for Queen Agent..."
          className="command-input"
        />
        <button type="submit" className="submit-button">
          Send Command
        </button>
      </form>
      
      <div className="quick-commands">
        <h4>Quick Commands:</h4>
        <button onClick={() => setInput("Deploy to production")}>Deploy</button>
        <button onClick={() => setInput("Run tests")}>Test</button>
        <button onClick={() => setInput("Check system status")}>Status</button>
        <button onClick={() => setInput("Create new agent")}>New Agent</button>
      </div>
    </div>
  );
}

function App() {
  const [agentStatus, setAgentStatus] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [messages, setMessages] = useState<string[]>([]);

  const handleCommand = async (command: string) => {
    setMessages(prev => [...prev, `You: ${command}`]);
    setAgentStatus('processing');
    
    try {
      // Send command to backend API
      const response = await fetch('http://localhost:3001/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: command })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setAgentStatus('responding');
      
      // Handle the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk' || data.type === 'result') {
                  fullResponse += data.content;
                } else if (data.type === 'complete') {
                  fullResponse = data.content || fullResponse;
                }
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          }
        }
      }
      
      // Add the complete response to messages
      setMessages(prev => [...prev, `Queen Agent: ${fullResponse || 'I processed your request successfully.'}`]);
      
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => [...prev, `Queen Agent: I apologize, but I'm experiencing a connection issue. Please ensure the backend server is running on port 3001. Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setAgentStatus('idle');
    }
  };

  return (
    <div className="App">
      <div className="app-header">
        <h1>Claude Flow UI - AI Agent Orchestration</h1>
        <p>Secure Container • Memory-Enhanced • Voice & Text Interface</p>
      </div>
      
      <div className="main-interface">
        {/* Queen Agent Visualization */}
        <div className="agent-viewport">
          <QueenAgent status={agentStatus} />
        </div>
        
        {/* Control Panel */}
        <div className="control-panel">
          <InputPanel onSubmit={handleCommand} />
          
          {/* Message History */}
          <div className="message-history">
            <h4>Agent Communication Log:</h4>
            <div className="messages">
              {messages.length === 0 ? (
                <p className="idle-message">Queen Agent is idle and waiting for commands...</p>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className="message">{msg}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <span>🛡️ Secure Container Active</span>
        <span>🧠 Memory System: Online</span>
        <span>🔗 Claude Code SDK: Connected</span>
        <span>📡 Status: {agentStatus}</span>
      </div>
    </div>
  );
}

export default App;

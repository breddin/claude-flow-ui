import React, { useState, useEffect, useRef } from 'react';
import QueenAgentImage from './QueenAgent.webp';
import Login from './components/Login';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
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

// Research Agent Component
function ResearchAgent({ status, isActive }: { status: 'idle' | 'researching' | 'complete', isActive: boolean }) {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 0.1) % (Math.PI * 2));
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return '#6C7B7F';        // Gray - waiting
      case 'researching': return '#50E3C2'; // Teal - researching
      case 'complete': return '#4A90E2';    // Blue - complete
      default: return '#6C7B7F';
    }
  };

  const floatingOffset = Math.sin(animationPhase * 1.2) * 8;
  const opacity = isActive ? 1 : 0.5;

  return (
    <div className="research-agent-container" style={{ opacity }}>
      <div className="research-particles">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i}
            className="research-particle"
            style={{
              '--angle': `${i * 60}deg`,
              '--delay': `${i * 0.3}s`
            } as React.CSSProperties}
          >
            🔍
          </div>
        ))}
      </div>
      
      <div 
        className="research-agent-icon"
        style={{
          transform: `translateY(${floatingOffset}px)`,
          boxShadow: `0 0 20px ${getStatusColor()}`,
          borderColor: getStatusColor(),
          backgroundColor: getStatusColor()
        }}
      >
        🧠
      </div>
      
      <div className="status-text">
        Research Agent: {status.toUpperCase()}
      </div>
    </div>
  );
}

// Implementation Agent Component
function ImplementationAgent({ status, isActive }: { status: 'idle' | 'implementing' | 'complete', isActive: boolean }) {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 0.1) % (Math.PI * 2));
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return '#6C7B7F';        // Gray - waiting
      case 'implementing': return '#F5A623'; // Orange - implementing
      case 'complete': return '#7ED321';    // Green - complete
      default: return '#6C7B7F';
    }
  };

  const floatingOffset = Math.sin(animationPhase * 0.8) * 12;
  const opacity = isActive ? 1 : 0.5;

  return (
    <div className="implementation-agent-container" style={{ opacity }}>
      <div className="implementation-particles">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i}
            className="implementation-particle"
            style={{
              '--angle': `${i * 72}deg`,
              '--delay': `${i * 0.25}s`
            } as React.CSSProperties}
          >
            ⚙️
          </div>
        ))}
      </div>
      
      <div 
        className="implementation-agent-icon"
        style={{
          transform: `translateY(${floatingOffset}px)`,
          boxShadow: `0 0 20px ${getStatusColor()}`,
          borderColor: getStatusColor(),
          backgroundColor: getStatusColor()
        }}
      >
        🛠️
      </div>
      
      <div className="status-text">
        Implementation Agent: {status.toUpperCase()}
      </div>
    </div>
  );
}

// Input Panel Component
function InputPanel({ onSubmit, onSingleAgentSubmit }: { 
  onSubmit: (message: string) => void,
  onSingleAgentSubmit: (message: string) => void 
}) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [mode, setMode] = useState<'multi' | 'single'>('multi');

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
      if (mode === 'multi') {
        onSubmit(input.trim());
      } else {
        onSingleAgentSubmit(input.trim());
      }
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
        <div className="mode-selector">
          <button 
            className={mode === 'multi' ? 'active' : ''}
            onClick={() => setMode('multi')}
          >
            🤖 Multi-Agent
          </button>
          <button 
            className={mode === 'single' ? 'active' : ''}
            onClick={() => setMode('single')}
          >
            👑 Queen Only
          </button>
        </div>
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
          placeholder={mode === 'multi' ? 
            "Enter command for multi-agent orchestration..." : 
            "Enter command for Queen Agent only..."}
          className="command-input"
        />
        <button type="submit" className="submit-button">
          {mode === 'multi' ? 'Send to Agents' : 'Send to Queen'}
        </button>
      </form>
      
      <div className="quick-commands">
        <h4>Quick Commands:</h4>
        <button onClick={() => setInput("How do I implement user authentication in a React app?")}>Auth Implementation</button>
        <button onClick={() => setInput("Design a database schema for an e-commerce platform")}>Database Design</button>
        <button onClick={() => setInput("Create a deployment strategy for microservices")}>Deployment Strategy</button>
        <button onClick={() => setInput("Optimize React performance for large datasets")}>Performance Optimization</button>
      </div>
    </div>
  );
}

function App() {
  const [agentStatus, setAgentStatus] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [researchStatus, setResearchStatus] = useState<'idle' | 'researching' | 'complete'>('idle');
  const [implementationStatus, setImplementationStatus] = useState<'idle' | 'implementing' | 'complete'>('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [orchestrationActive, setOrchestrationActive] = useState(false);
  const [currentStage, setCurrentStage] = useState<'analysis' | 'research' | 'implementation' | 'synthesis' | 'complete'>('analysis');
  const [showCompletedStatus, setShowCompletedStatus] = useState(false);
  
  // Reference for auto-scrolling messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Check for existing authentication on app load
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData && userData !== 'undefined') {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleLogin = (token: string, userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setShowAdminDashboard(false);
  };

  const toggleAdminDashboard = () => {
    setShowAdminDashboard(!showAdminDashboard);
  };

  const handleCommand = async (command: string) => {
    setMessages(prev => [...prev, `You: ${command}`]);
    setOrchestrationActive(true);
    setAgentStatus('processing');
    setResearchStatus('idle');
    setImplementationStatus('idle');
    setCurrentStage('analysis');
    
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      // Send command to multi-agent orchestration endpoint
      const response = await fetch(`${apiUrl}/api/multi-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      let currentAgentResponse = '';
      let currentAgent = 'queen';

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
                
                if (data.type === 'agent_status') {
                  // Update agent status
                  if (data.agent === 'queen') {
                    if (data.status === 'analyzing') {
                      setAgentStatus('processing');
                      setCurrentStage('analysis');
                    } else if (data.status === 'synthesizing') {
                      setAgentStatus('responding');
                      setCurrentStage('synthesis');
                    }
                  } else if (data.agent === 'research') {
                    setResearchStatus('researching');
                    setCurrentStage('research');
                  } else if (data.agent === 'implementation') {
                    setImplementationStatus('implementing');
                    setCurrentStage('implementation');
                  }
                  
                  // Add status message
                  setMessages(prev => [...prev, `🤖 ${data.message}`]);
                  
                } else if (data.type === 'agent_response') {
                  // Handle agent responses - display them immediately
                  const agentName = data.agent === 'queen' ? 'Queen Agent' : 
                                  data.agent === 'research' ? 'Research Agent' : 
                                  'Implementation Agent';
                  
                  setMessages(prev => [...prev, `${agentName}: ${data.content}`]);
                  
                  // Update agent completion status
                  if (data.stage === 'analysis' || data.agent === 'queen') {
                    setAgentStatus('idle'); // Queen agent completed, back to idle
                  } else if (data.stage === 'research' || data.agent === 'research') {
                    setResearchStatus('complete');
                  } else if (data.stage === 'implementation' || data.agent === 'implementation') {
                    setImplementationStatus('complete');
                    
                    // Fallback: If implementation agent completes and we're in implementation stage,
                    // assume orchestration is complete (in case backend doesn't send orchestration_complete)
                    if (currentStage === 'implementation') {
                      setTimeout(() => {
                        console.log('Fallback: Implementation agent completed, triggering orchestration completion');
                        setCurrentStage('complete');
                        setShowCompletedStatus(true);
                        setMessages(prev => [...prev, `✅ Multi-agent orchestration completed successfully! (auto-detected)`]);
                        
                        // Keep orchestration active briefly to show completion status
                        setTimeout(() => {
                          setOrchestrationActive(false);
                          setShowCompletedStatus(false);
                          // Reset statuses after showing completion
                          setTimeout(() => {
                            setResearchStatus('idle');
                            setImplementationStatus('idle');
                            setCurrentStage('analysis');
                          }, 1000);
                        }, 3000);
                      }, 2000); // Wait 2 seconds for potential orchestration_complete event
                    }
                  }
                  
                  // Additional fallback: If Queen agent responds during synthesis stage,
                  // that typically means orchestration is complete
                  if ((data.stage === 'synthesis' || currentStage === 'synthesis') && data.agent === 'queen') {
                    setTimeout(() => {
                      // Only trigger if we haven't already completed
                      if (currentStage !== 'complete') {
                        console.log('Fallback: Queen synthesis completed, triggering orchestration completion');
                        setCurrentStage('complete');
                        setShowCompletedStatus(true);
                        setMessages(prev => [...prev, `✅ Multi-agent orchestration completed successfully! (auto-detected)`]);
                        
                        // Keep orchestration active briefly to show completion status
                        setTimeout(() => {
                          setOrchestrationActive(false);
                          setShowCompletedStatus(false);
                          // Reset statuses after showing completion
                          setTimeout(() => {
                            setResearchStatus('idle');
                            setImplementationStatus('idle');
                            setCurrentStage('analysis');
                          }, 1000);
                        }, 3000);
                      }
                    }, 2000); // Wait 2 seconds for potential orchestration_complete event
                  }
                  
                } else if (data.type === 'orchestration_complete') {
                  // Final completion
                  setAgentStatus('idle');
                  setResearchStatus('complete');
                  setImplementationStatus('complete');
                  setCurrentStage('complete');
                  setShowCompletedStatus(true);
                  
                  // Keep orchestration active briefly to show completion status
                  setTimeout(() => {
                    setOrchestrationActive(false);
                    setShowCompletedStatus(false);
                    // Reset statuses after showing completion
                    setTimeout(() => {
                      setResearchStatus('idle');
                      setImplementationStatus('idle');
                      setCurrentStage('analysis');
                    }, 1000);
                  }, 3000); // Show completion for 3 seconds
                  
                  // Display all agent responses from the stages data
                  if (data.stages) {
                    if (data.stages.analysis) {
                      setMessages(prev => [...prev, `Queen Agent: ${data.stages.analysis}`]);
                    }
                    if (data.stages.research) {
                      setMessages(prev => [...prev, `Research Agent: ${data.stages.research}`]);
                    }
                    if (data.stages.implementation) {
                      setMessages(prev => [...prev, `Implementation Agent: ${data.stages.implementation}`]);
                    }
                  }
                  
                  setMessages(prev => [...prev, `✅ Multi-agent orchestration completed successfully!`]);
                  
                } else if (data.type === 'error') {
                  const errorMessage = data.details ? 
                    `${data.message}: ${data.details}` : 
                    data.message;
                  setMessages(prev => [...prev, `❌ Error: ${errorMessage}`]);
                  setOrchestrationActive(false);
                  setShowCompletedStatus(false);
                  setAgentStatus('idle');
                  setResearchStatus('idle');
                  setImplementationStatus('idle');
                }
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          }
        }
      }
      
      // Final fallback: If we exit the stream but orchestration is still active,
      // check if we should auto-complete based on agent statuses
      setTimeout(() => {
        if (orchestrationActive && currentStage !== 'complete') {
          // Check if implementation agent completed but orchestration is still active
          if (implementationStatus === 'complete' && currentStage === 'implementation') {
            console.log('Stream ended with implementation complete - auto-completing orchestration');
            setCurrentStage('complete');
            setShowCompletedStatus(true);
            setMessages(prev => [...prev, `✅ Multi-agent orchestration completed successfully! (stream auto-complete)`]);
            
            setTimeout(() => {
              setOrchestrationActive(false);
              setShowCompletedStatus(false);
              setTimeout(() => {
                setResearchStatus('idle');
                setImplementationStatus('idle');
                setCurrentStage('analysis');
              }, 1000);
            }, 3000);
          }
          // Check if we're in synthesis stage (Queen should be finishing)
          else if (currentStage === 'synthesis' && agentStatus === 'idle') {
            console.log('Stream ended in synthesis with Queen idle - auto-completing orchestration');
            setCurrentStage('complete');
            setShowCompletedStatus(true);
            setMessages(prev => [...prev, `✅ Multi-agent orchestration completed successfully! (synthesis auto-complete)`]);
            
            setTimeout(() => {
              setOrchestrationActive(false);
              setShowCompletedStatus(false);
              setTimeout(() => {
                setResearchStatus('idle');
                setImplementationStatus('idle');
                setCurrentStage('analysis');
              }, 1000);
            }, 3000);
          }
        }
      }, 3000); // Wait 3 seconds after stream ends
      
    } catch (error) {
      console.error('API Error:', error);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      let errorMessage = '';
      if (error instanceof Error) {
        if (error.message.includes('Authentication required') || error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please check your API credentials.';
        } else if (error.message.includes('insufficient credits') || error.message.includes('credit balance')) {
          errorMessage = 'API service has insufficient credits. Please check your account balance.';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = `Connection failed. Please ensure the backend server is running at ${apiUrl}.`;
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Unknown error occurred';
      }
      
      setMessages(prev => [...prev, `Queen Agent: I apologize, but I encountered an issue during multi-agent orchestration: ${errorMessage}`]);
      setOrchestrationActive(false);
      setShowCompletedStatus(false);
    } finally {
      setAgentStatus('idle');
      setResearchStatus('idle');
      setImplementationStatus('idle');
    }
  };

  const handleSingleAgentCommand = async (command: string) => {
    setMessages(prev => [...prev, `You (Single Agent): ${command}`]);
    setAgentStatus('processing');
    
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      // Send command to original single-agent endpoint
      const response = await fetch(`${apiUrl}/api/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: command })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setAgentStatus('responding');
      
      // Handle the streaming response (original implementation)
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
                } else if (data.type === 'error') {
                  // Handle backend error messages
                  const errorMessage = data.details ? 
                    `${data.content}: ${data.details}` : 
                    data.content;
                  throw new Error(errorMessage);
                }
              } catch (e) {
                if (e instanceof Error && e.message.includes('API')) {
                  throw e; // Re-throw API errors
                }
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      let errorMessage = '';
      if (error instanceof Error) {
        if (error.message.includes('Authentication required') || error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please check your API credentials.';
        } else if (error.message.includes('insufficient credits') || error.message.includes('credit balance')) {
          errorMessage = 'API service has insufficient credits. Please check your account balance.';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = `Connection failed. Please ensure the backend server is running at ${apiUrl}.`;
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Unknown error occurred';
      }
      
      setMessages(prev => [...prev, `Queen Agent: I apologize, but I encountered an issue: ${errorMessage}`]);
    } finally {
      setAgentStatus('idle');
    }
  };

  // If not authenticated, show login
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // If authenticated but user data not yet loaded, show loading
  if (!user) {
    return (
      <div className="App">
        <div className="loading-container">
          <p>Loading user data...</p>
        </div>
      </div>
    );
  }

  // If showing admin dashboard
  if (showAdminDashboard) {
    return (
      <div className="App">
        <Header 
          user={user} 
          onLogout={handleLogout} 
          onShowAdmin={toggleAdminDashboard}
          showingAdmin={true}
        />
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div className="App">
      <Header 
        user={user} 
        onLogout={handleLogout} 
        onShowAdmin={toggleAdminDashboard}
        showingAdmin={false}
      />
      
      {(orchestrationActive || currentStage === 'complete') && (
        <div className="orchestration-status">
          {currentStage === 'complete' ? (
            <span>✅ Multi-Agent Orchestration Completed Successfully</span>
          ) : (
            <span>🔄 Multi-Agent Orchestration Active - Stage: {currentStage.toUpperCase()}</span>
          )}
        </div>
      )}
      
      <div className="main-interface">&lt;
        {/* Multi-Agent Visualization */}
        <div className="agent-viewport">
          <div className="agents-grid">
            {/* Queen Agent - Center */}
            <div className="queen-position">
              <QueenAgent status={agentStatus} />
            </div>
            
            {/* Research Agent - Left */}
            <div className="research-position">
              <ResearchAgent 
                status={researchStatus} 
                isActive={orchestrationActive && (currentStage === 'research' || researchStatus === 'complete')} 
              />
            </div>
            
            {/* Implementation Agent - Right */}
            <div className="implementation-position">
              <ImplementationAgent 
                status={implementationStatus} 
                isActive={orchestrationActive && (currentStage === 'implementation' || implementationStatus === 'complete')} 
              />
            </div>
          </div>
          
          {/* Orchestration Flow Indicators */}
          {orchestrationActive && (
            <div className="flow-indicators">
              <div className={`flow-arrow queen-to-research ${currentStage === 'research' ? 'active' : ''}`}>
                ➤
              </div>
              <div className={`flow-arrow research-to-implementation ${currentStage === 'implementation' ? 'active' : ''}`}>
                ➤
              </div>
              <div className={`flow-arrow implementation-to-queen ${currentStage === 'synthesis' ? 'active' : ''}`}>
                ➤
              </div>
            </div>
          )}
        </div>
        
        {/* Control Panel */}
        <div className="control-panel">
          <InputPanel 
            onSubmit={handleCommand} 
            onSingleAgentSubmit={handleSingleAgentCommand}
          />
          
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
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <span>🛡️ Secure Container Active</span>
        <span>🧠 Memory System: Online</span>
        <span>🔗 Claude Code SDK: Connected</span>
        <span>📡 Status: {agentStatus}</span>
        {(orchestrationActive || showCompletedStatus) && (
          <>
            <span>🔍 Research: {researchStatus}</span>
            <span>🛠️ Implementation: {implementationStatus}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

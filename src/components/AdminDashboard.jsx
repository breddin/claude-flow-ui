import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9001';
      console.log('Environment variable REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
      console.log('Using API URL:', apiUrl);
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch all admin data in parallel
      const [sessionsRes, agentsRes, tasksRes, communicationsRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/sessions`, { headers }),
        fetch(`${apiUrl}/api/admin/agents`, { headers }),
        fetch(`${apiUrl}/api/admin/tasks`, { headers }),
        fetch(`${apiUrl}/api/admin/communications`, { headers })
      ]);

      if (!sessionsRes.ok || !agentsRes.ok || !tasksRes.ok || !communicationsRes.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const [sessionsData, agentsData, tasksData, communicationsData] = await Promise.all([
        sessionsRes.json(),
        agentsRes.json(),
        tasksRes.json(),
        communicationsRes.json()
      ]);

      setSessions(sessionsData.data || []);
      setAgents(agentsData.data || []);
      setTasks(tasksData.data || []);
      setCommunications(communicationsData.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async (type = 'all') => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const token = localStorage.getItem('accessToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9001';
      
      const response = await fetch(`${apiUrl}/api/admin/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      const result = await response.json();

      if (response.ok) {
        setSyncMessage(`✅ ${result.message}`);
        // Refresh data after successful sync
        await fetchAdminData();
      } else {
        setSyncMessage(`❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncMessage(`❌ Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start, end) => {
    if (!start) return 'N/A';
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = Math.floor((endTime - startTime) / 1000 / 60); // minutes
    return `${duration} minutes`;
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'active': 'badge-success',
      'completed': 'badge-info',
      'failed': 'badge-danger',
      'pending': 'badge-warning',
      'idle': 'badge-secondary',
      'running': 'badge-primary'
    };
    return `badge ${statusColors[status] || 'badge-secondary'}`;
  };

  const SessionsPanel = () => (
    <div className="admin-panel">
      <div className="panel-header">
        <h3>🗂️ Orchestration Sessions ({sessions.length})</h3>
        <button className="btn-refresh" onClick={fetchAdminData}>
          🔄 Refresh
        </button>
      </div>
      
      <div className="sessions-grid">
        {sessions.map(session => (
          <div 
            key={session.id} 
            className={`session-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
            onClick={() => setSelectedSession(session)}
          >
            <div className="session-header">
              <span className="session-id">#{session.session_id}</span>
              <span className={getStatusBadge(session.status)}>{session.status}</span>
            </div>
            
            <div className="session-info">
              <div className="info-row">
                <span className="label">User:</span>
                <span className="value">{session.username || 'Unknown'}</span>
              </div>
              <div className="info-row">
                <span className="label">Tenant:</span>
                <span className="value">{session.tenant_id || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Started:</span>
                <span className="value">{formatTimestamp(session.created_at)}</span>
              </div>
              <div className="info-row">
                <span className="label">Duration:</span>
                <span className="value">{formatDuration(session.created_at, session.updated_at)}</span>
              </div>
            </div>

            {session.config && (
              <div className="session-config">
                <h4>Configuration</h4>
                <div className="config-items">
                  {Object.entries(session.config).map(([key, value]) => (
                    <div key={key} className="config-item">
                      <span className="config-key">{key}:</span>
                      <span className="config-value">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedSession && (
        <div className="session-details">
          <h4>📋 Session Details: {selectedSession.session_id}</h4>
          <div className="details-grid">
            <div className="detail-section">
              <h5>Basic Information</h5>
              <table className="details-table">
                <tbody>
                  <tr><td>Session ID</td><td>{selectedSession.session_id}</td></tr>
                  <tr><td>Status</td><td><span className={getStatusBadge(selectedSession.status)}>{selectedSession.status}</span></td></tr>
                  <tr><td>User ID</td><td>{selectedSession.user_id}</td></tr>
                  <tr><td>Tenant</td><td>{selectedSession.tenant_id}</td></tr>
                  <tr><td>Created</td><td>{formatTimestamp(selectedSession.created_at)}</td></tr>
                  <tr><td>Updated</td><td>{formatTimestamp(selectedSession.updated_at)}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="detail-section">
              <h5>Configuration</h5>
              <pre className="json-display">
                {JSON.stringify(selectedSession.config, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const AgentsPanel = () => (
    <div className="admin-panel">
      <div className="panel-header">
        <h3>🤖 Active Agents ({agents.length})</h3>
        <button className="btn-refresh" onClick={fetchAdminData}>
          🔄 Refresh
        </button>
      </div>
      
      <div className="agents-grid">
        {agents.map(agent => (
          <div 
            key={agent.id} 
            className={`agent-card ${selectedAgent?.id === agent.id ? 'selected' : ''}`}
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="agent-header">
              <span className="agent-name">{agent.name}</span>
              <span className={getStatusBadge(agent.status)}>{agent.status}</span>
            </div>
            
            <div className="agent-info">
              <div className="info-row">
                <span className="label">Type:</span>
                <span className="value">{agent.type}</span>
              </div>
              <div className="info-row">
                <span className="label">User:</span>
                <span className="value">{agent.username || 'Unknown'}</span>
              </div>
              <div className="info-row">
                <span className="label">Tenant:</span>
                <span className="value">{agent.tenant_id || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="label">Created:</span>
                <span className="value">{formatTimestamp(agent.created_at)}</span>
              </div>
            </div>

            {agent.config && Object.keys(agent.config).length > 0 && (
              <div className="agent-config">
                <h4>Configuration</h4>
                <div className="config-summary">
                  {Object.keys(agent.config).slice(0, 3).map(key => (
                    <span key={key} className="config-tag">{key}</span>
                  ))}
                  {Object.keys(agent.config).length > 3 && (
                    <span className="config-more">+{Object.keys(agent.config).length - 3} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedAgent && (
        <div className="agent-details">
          <h4>🤖 Agent Details: {selectedAgent.name}</h4>
          <div className="details-grid">
            <div className="detail-section">
              <h5>Basic Information</h5>
              <table className="details-table">
                <tbody>
                  <tr><td>Name</td><td>{selectedAgent.name}</td></tr>
                  <tr><td>Type</td><td>{selectedAgent.type}</td></tr>
                  <tr><td>Status</td><td><span className={getStatusBadge(selectedAgent.status)}>{selectedAgent.status}</span></td></tr>
                  <tr><td>User ID</td><td>{selectedAgent.user_id}</td></tr>
                  <tr><td>Tenant</td><td>{selectedAgent.tenant_id}</td></tr>
                  <tr><td>Created</td><td>{formatTimestamp(selectedAgent.created_at)}</td></tr>
                  <tr><td>Updated</td><td>{formatTimestamp(selectedAgent.updated_at)}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="detail-section">
              <h5>Configuration</h5>
              <pre className="json-display">
                {JSON.stringify(selectedAgent.config, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const TasksPanel = () => (
    <div className="admin-panel">
      <div className="panel-header">
        <h3>📋 Recent Tasks ({tasks.length})</h3>
        <button className="btn-refresh" onClick={fetchAdminData}>
          🔄 Refresh
        </button>
      </div>
      
      <div className="tasks-list">
        {tasks.map(task => (
          <div key={task.id} className="task-item">
            <div className="task-header">
              <span className="task-id">Task #{task.id}</span>
              <span className={getStatusBadge(task.status)}>{task.status}</span>
              <span className="task-time">{formatTimestamp(task.created_at)}</span>
            </div>
            
            <div className="task-content">
              <div className="task-description">
                {task.description || task.input || 'No description available'}
              </div>
              
              {task.agent_name && (
                <div className="task-agent">
                  <span className="label">Agent:</span>
                  <span className="value">{task.agent_name}</span>
                </div>
              )}
              
              {task.output && (
                <div className="task-output">
                  <h5>Output</h5>
                  <pre className="output-display">
                    {typeof task.output === 'string' ? task.output : JSON.stringify(task.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CommunicationsPanel = () => (
    <div className="admin-panel">
      <div className="panel-header">
        <h3>💬 Communications Log ({communications.length})</h3>
        <button className="btn-refresh" onClick={fetchAdminData}>
          🔄 Refresh
        </button>
      </div>
      
      <div className="communications-list">
        {communications.map(comm => (
          <div key={comm.id} className="communication-item">
            <div className="comm-header">
              <span className="comm-type">{comm.type || 'Interaction'}</span>
              <span className="comm-time">{formatTimestamp(comm.created_at)}</span>
            </div>
            
            <div className="comm-content">
              {comm.input && (
                <div className="comm-input">
                  <h5>📥 Input</h5>
                  <div className="message-content">
                    {typeof comm.input === 'string' ? comm.input : JSON.stringify(comm.input, null, 2)}
                  </div>
                </div>
              )}
              
              {comm.output && (
                <div className="comm-output">
                  <h5>📤 Output</h5>
                  <div className="message-content">
                    {typeof comm.output === 'string' ? comm.output : JSON.stringify(comm.output, null, 2)}
                  </div>
                </div>
              )}
              
              {comm.agent_name && (
                <div className="comm-meta">
                  <span className="label">Agent:</span>
                  <span className="value">{comm.agent_name}</span>
                  {comm.user_name && (
                    <>
                      <span className="label">User:</span>
                      <span className="value">{comm.user_name}</span>
                    </>
                  )}
                </div>
              )}
              
              {comm.metadata && Object.keys(comm.metadata).length > 0 && (
                <details className="comm-metadata">
                  <summary>Metadata</summary>
                  <pre className="metadata-display">
                    {JSON.stringify(comm.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <h3>❌ Error Loading Admin Data</h3>
        <p>{error}</p>
        <button onClick={fetchAdminData} className="btn-retry">
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>🛠️ Admin Dashboard</h2>
        <div className="dashboard-controls">
          <div className="sync-controls">
            <button 
              className={`btn-sync ${syncing ? 'syncing' : ''}`}
              onClick={() => syncData('all')}
              disabled={syncing}
            >
              {syncing ? '🔄 Syncing...' : '🔄 Sync Data'}
            </button>
            {syncMessage && (
              <div className="sync-message">{syncMessage}</div>
            )}
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <span className="stat-number">{sessions.length}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{agents.length}</span>
              <span className="stat-label">Agents</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{tasks.length}</span>
              <span className="stat-label">Tasks</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{communications.length}</span>
              <span className="stat-label">Messages</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            🗂️ Sessions ({sessions.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            🤖 Agents ({agents.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            📋 Tasks ({tasks.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'communications' ? 'active' : ''}`}
            onClick={() => setActiveTab('communications')}
          >
            💬 Messages ({communications.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'sessions' && <SessionsPanel />}
          {activeTab === 'agents' && <AgentsPanel />}
          {activeTab === 'tasks' && <TasksPanel />}
          {activeTab === 'communications' && <CommunicationsPanel />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

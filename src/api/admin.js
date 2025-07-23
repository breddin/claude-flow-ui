import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import jwt from 'jsonwebtoken';
import DataSyncService from '../services/dataSyncService.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware to verify admin access
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user has admin privileges
    const client = await pool.connect();
    try {
      await client.query('SET search_path TO sensumaster_dev, public');
      
      const adminCheck = await client.query(`
        SELECT 
          logon_user,
          user_name,
          tenant_id,
          is_admin,
          roles
        FROM v_user_authentication 
        WHERE logon_user = $1 AND is_active = true
      `, [decoded.username]);

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }

      const user = adminCheck.rows[0];
      
      // Check if user is admin or has admin role
      const isAdmin = user.is_admin || 
                     (user.roles && user.roles.some(role => 
                       role.toLowerCase().includes('admin') || 
                       role.toLowerCase().includes('administrator')
                     ));

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user = {
        username: user.logon_user,
        name: user.user_name,
        tenant_id: user.tenant_id,
        is_admin: user.is_admin,
        roles: user.roles
      };

      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get all orchestration sessions
router.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Set schema path
      await client.query('SET search_path TO sensumaster_dev, public');
      
      // Get sessions with user information
      const sessionsQuery = `
        SELECT 
          s.*,
          u.user_name as username,
          u.email as user_email
        FROM orchestration_sessions s
        LEFT JOIN v_user_authentication u ON s.user_id = u.logon_user
        ORDER BY s.created_at DESC
        LIMIT 100
      `;
      
      const result = await client.query(sessionsQuery);
      
      // Parse JSON fields
      const sessions = result.rows.map(session => ({
        ...session,
        config: session.config ? (typeof session.config === 'string' ? JSON.parse(session.config) : session.config) : {},
        metadata: session.metadata ? (typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata) : {}
      }));

      res.json({
        success: true,
        data: sessions,
        count: sessions.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sessions',
      details: error.message 
    });
  }
});

// Get all agents
router.get('/agents', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Set schema path
      await client.query('SET search_path TO sensumaster_dev, public');
      
      const agentsQuery = `
        SELECT 
          a.*,
          u.user_name as username,
          u.email as user_email,
          s.session_id
        FROM agents a
        LEFT JOIN v_user_authentication u ON a.user_id = u.logon_user
        LEFT JOIN orchestration_sessions s ON a.session_id = s.id
        ORDER BY a.created_at DESC
        LIMIT 100
      `;
      
      const result = await client.query(agentsQuery);
      
      // Parse JSON fields
      const agents = result.rows.map(agent => ({
        ...agent,
        config: agent.config ? (typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config) : {},
        metadata: agent.metadata ? (typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : agent.metadata) : {}
      }));

      res.json({
        success: true,
        data: agents,
        count: agents.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch agents',
      details: error.message 
    });
  }
});

// Get all tasks
router.get('/tasks', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Set schema path
      await client.query('SET search_path TO sensumaster_dev, public');
      
      const tasksQuery = `
        SELECT 
          t.*,
          a.name as agent_name,
          a.type as agent_type,
          u.user_name as username,
          s.session_id
        FROM tasks t
        LEFT JOIN agents a ON t.agent_id = a.id
        LEFT JOIN v_user_authentication u ON t.user_id = u.logon_user
        LEFT JOIN orchestration_sessions s ON t.session_id = s.id
        ORDER BY t.created_at DESC
        LIMIT 200
      `;
      
      const result = await client.query(tasksQuery);
      
      // Parse JSON fields
      const tasks = result.rows.map(task => ({
        ...task,
        input: task.input ? (typeof task.input === 'string' ? JSON.parse(task.input) : task.input) : null,
        output: task.output ? (typeof task.output === 'string' ? JSON.parse(task.output) : task.output) : null,
        metadata: task.metadata ? (typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata) : {}
      }));

      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tasks',
      details: error.message 
    });
  }
});

// Get all communications/interactions
router.get('/communications', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Set schema path
      await client.query('SET search_path TO sensumaster_dev, public');
      
      const communicationsQuery = `
        SELECT 
          c.*,
          a.name as agent_name,
          a.type as agent_type,
          u.user_name as user_name,
          s.session_id
        FROM agent_communications c
        LEFT JOIN agents a ON c.agent_id = a.id
        LEFT JOIN v_user_authentication u ON c.user_id = u.logon_user
        LEFT JOIN orchestration_sessions s ON c.session_id = s.id
        ORDER BY c.created_at DESC
        LIMIT 200
      `;
      
      const result = await client.query(communicationsQuery);
      
      // Parse JSON fields
      const communications = result.rows.map(comm => ({
        ...comm,
        input: comm.input ? (typeof comm.input === 'string' ? JSON.parse(comm.input) : comm.input) : null,
        output: comm.output ? (typeof comm.output === 'string' ? JSON.parse(comm.output) : comm.output) : null,
        metadata: comm.metadata ? (typeof comm.metadata === 'string' ? JSON.parse(comm.metadata) : comm.metadata) : {}
      }));

      res.json({
        success: true,
        data: communications,
        count: communications.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch communications',
      details: error.message 
    });
  }
});

// Get admin dashboard summary statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Set schema path
      await client.query('SET search_path TO sensumaster_dev, public');
      
      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM orchestration_sessions WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_24h,
          (SELECT COUNT(*) FROM agents WHERE status = 'active') as active_agents,
          (SELECT COUNT(*) FROM tasks WHERE created_at > NOW() - INTERVAL '24 hours') as tasks_24h,
          (SELECT COUNT(*) FROM agent_communications WHERE created_at > NOW() - INTERVAL '24 hours') as communications_24h,
          (SELECT COUNT(DISTINCT tenant_id) FROM v_user_authentication WHERE is_active = true) as active_tenants,
          (SELECT COUNT(*) FROM v_user_authentication WHERE is_active = true) as active_users
      `;
      
      const result = await client.query(statsQuery);
      const stats = result.rows[0];

      res.json({
        success: true,
        data: {
          sessions_today: parseInt(stats.sessions_24h) || 0,
          active_agents: parseInt(stats.active_agents) || 0,
          tasks_today: parseInt(stats.tasks_24h) || 0,
          communications_today: parseInt(stats.communications_24h) || 0,
          active_tenants: parseInt(stats.active_tenants) || 0,
          active_users: parseInt(stats.active_users) || 0
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// Get session details by ID
router.get('/sessions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      // Get session details
      const sessionQuery = `
        SELECT 
          s.*,
          u.user_name as username,
          u.email as user_email
        FROM orchestration_sessions s
        LEFT JOIN v_user_authentication u ON s.user_id = u.logon_user
        WHERE s.id = $1 OR s.session_id = $1
      `;
      
      const sessionResult = await client.query(sessionQuery, [id]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Session not found' 
        });
      }

      const session = sessionResult.rows[0];
      
      // Get associated agents
      const agentsQuery = `
        SELECT * FROM agents 
        WHERE session_id = $1 
        ORDER BY created_at
      `;
      const agentsResult = await client.query(agentsQuery, [session.id]);
      
      // Get associated tasks
      const tasksQuery = `
        SELECT 
          t.*,
          a.name as agent_name
        FROM tasks t
        LEFT JOIN agents a ON t.agent_id = a.id
        WHERE t.session_id = $1 
        ORDER BY t.created_at
      `;
      const tasksResult = await client.query(tasksQuery, [session.id]);
      
      // Get associated communications
      const commQuery = `
        SELECT 
          c.*,
          a.name as agent_name
        FROM agent_communications c
        LEFT JOIN agents a ON c.agent_id = a.id
        WHERE c.session_id = $1 
        ORDER BY c.created_at
      `;
      const commResult = await client.query(commQuery, [session.id]);

      res.json({
        success: true,
        data: {
          session: {
            ...session,
            config: session.config ? (typeof session.config === 'string' ? JSON.parse(session.config) : session.config) : {},
            metadata: session.metadata ? (typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata) : {}
          },
          agents: agentsResult.rows.map(agent => ({
            ...agent,
            config: agent.config ? (typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config) : {},
            metadata: agent.metadata ? (typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : agent.metadata) : {}
          })),
          tasks: tasksResult.rows.map(task => ({
            ...task,
            input: task.input ? (typeof task.input === 'string' ? JSON.parse(task.input) : task.input) : null,
            output: task.output ? (typeof task.output === 'string' ? JSON.parse(task.output) : task.output) : null,
            metadata: task.metadata ? (typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata) : {}
          })),
          communications: commResult.rows.map(comm => ({
            ...comm,
            input: comm.input ? (typeof comm.input === 'string' ? JSON.parse(comm.input) : comm.input) : null,
            output: comm.output ? (typeof comm.output === 'string' ? JSON.parse(comm.output) : comm.output) : null,
            metadata: comm.metadata ? (typeof comm.metadata === 'string' ? JSON.parse(comm.metadata) : comm.metadata) : {}
          }))
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch session details',
      details: error.message 
    });
  }
});

// Data synchronization endpoint
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const { type = 'all' } = req.body;
    
    console.log(`🔄 Starting data sync (type: ${type}) requested by ${req.user.username}`);
    
    const syncService = new DataSyncService();
    
    try {
      switch (type) {
        case 'sessions':
          await syncService.syncOrchestrationSessions();
          break;
        case 'agents':
          await syncService.syncAgents();
          break;
        case 'tasks':
          await syncService.syncTasks();
          break;
        case 'communications':
          await syncService.syncCommunications();
          break;
        case 'all':
        default:
          await syncService.syncAll();
          break;
      }
      
      res.json({
        success: true,
        message: `Data synchronization (${type}) completed successfully`,
        timestamp: new Date().toISOString(),
        requestedBy: req.user.username
      });
      
      console.log(`✅ Data sync (${type}) completed successfully`);
    } finally {
      await syncService.close();
    }
  } catch (error) {
    console.error('Error during data synchronization:', error);
    res.status(500).json({
      success: false,
      error: 'Data synchronization failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for admin endpoints
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;

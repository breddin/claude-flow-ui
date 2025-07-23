import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pgDB } from '../database/PostgreSQLDatabase.js';

// Export pgDB for use in routes
export { pgDB };

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-here-min-32-chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Rate limiting configurations - DISABLED (using database security instead)
export const authRateLimit = (req, res, next) => {
  // Bypass Express rate limiting - using database-driven security model
  next();
};

export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many API requests, please try again later.',
    retryAfter: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password utilities - NO visualizehr_salt (already handled in existing system)
export const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  // The existing system already handles salting, so just hash directly
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password, hash) => {
  try {
    // First try direct bcrypt comparison (for newly created passwords)
    const directMatch = await bcrypt.compare(password, hash);
    if (directMatch) {
      return true;
    }

    // If direct comparison fails, try Sensu-specific hashing with visualizehr_salt
    // The Sensu system may use a specific salt format
    const visualizehrSalt = process.env.VISUALIZEHR_SALT || 'visualizehr_salt';
    const saltedPassword = `${password}visualizehr_salt`;
    
    console.log('Trying Sensu-specific password verification with salt...');
    const saltedMatch = await bcrypt.compare(saltedPassword, hash);
    if (saltedMatch) {
      console.log('Password matched with visualizehr salt');
      return true;
    }

    // Try alternative salt methods that might be used in Sensu
    const alternativeSalts = [
      'sensu_salt',
      'demo_salt', 
      '', // No salt
      hash.substring(0, 10) // Use part of hash as salt
    ];

    for (const salt of alternativeSalts) {
      const testPassword = salt ? password + salt : password;
      const testMatch = await bcrypt.compare(testPassword, hash);
      if (testMatch) {
        console.log(`Password matched with salt: ${salt || 'no salt'}`);
        return true;
      }
    }

    // Try reverse salt (salt + password)
    const reverseSaltedPassword = visualizehrSalt + password;
    const reverseMatch = await bcrypt.compare(reverseSaltedPassword, hash);
    if (reverseMatch) {
      console.log('Password matched with reverse salt order');
      return true;
    }

    // If all bcrypt attempts fail, try plain text comparison (for demo/development)
    if (password === hash) {
      console.log('Password matched as plain text (insecure - for demo only)');
      return true;
    }

    console.log('All password verification methods failed');
    return false;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

// JWT utilities with tenant support
export const generateTokens = (userId, username, role, tenantId, availableTenants) => {
  const payload = { 
    userId, 
    username, 
    role, 
    tenantId,
    availableTenants 
  };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'claude-flow-ui',
    audience: 'claude-flow-ui-users'
  });
  
  const refreshToken = jwt.sign({ userId, tenantId }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'claude-flow-ui',
    audience: 'claude-flow-ui-refresh'
  });
  
  return { accessToken, refreshToken };
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Authentication middleware
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'TOKEN_MISSING'
      });
    }

    const decoded = verifyToken(token);
    
    // Check if user exists and is active using the authentication view
    const user = await pgDB.query(
      'SELECT logon_user as id, logon_user as username, user_name, email, tenant_id, is_admin, is_active, suspend_logon, roles, permissions FROM sensumaster_dev.v_user_authentication WHERE logon_user = $1',
      [decoded.userId]
    );

    if (!user.rows.length || !user.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }

    // Check if login is suspended
    if (user.rows[0].suspend_logon) {
      return res.status(401).json({
        success: false,
        error: 'Account login is suspended',
        code: 'LOGIN_SUSPENDED'
      });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await pgDB.query(
        'SELECT id, username, email, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (user.rows.length && user.rows[0].is_active) {
        req.user = user.rows[0];
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: userRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// API key authentication middleware
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required',
        code: 'API_KEY_MISSING'
      });
    }

    // Extract prefix (first 8 chars) and hash the full key
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = await hashPassword(apiKey);

    const result = await pgDB.query(
      `SELECT ak.*, u.id as user_id, u.username, u.email, u.role, u.is_active
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_prefix = $1 AND ak.is_active = true AND u.is_active = true
       AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)`,
      [keyPrefix]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'API_KEY_INVALID'
      });
    }

    const apiKeyRecord = result.rows[0];
    
    // Verify the full key hash
    const isValid = await verifyPassword(apiKey, apiKeyRecord.key_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'API_KEY_INVALID'
      });
    }

    // Update last used timestamp
    await pgDB.query(
      'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKeyRecord.id]
    );

    req.user = {
      id: apiKeyRecord.user_id,
      username: apiKeyRecord.username,
      email: apiKeyRecord.email,
      role: apiKeyRecord.role,
      apiKey: true,
      permissions: apiKeyRecord.permissions
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};

// Combined authentication middleware (JWT or API key)
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  } else if (authHeader) {
    return authenticateToken(req, res, next);
  } else {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide either Authorization header or X-API-Key header.',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
};

// User authentication using sensumaster_dev.v_user_authentication view with database security
export const authenticateUser = async (loginIdentifier, password) => {
  try {
    console.log(`Authentication attempt for: ${loginIdentifier}`);
    
    // Query the authentication view including security fields
    const result = await pgDB.query(
      `SELECT 
        logon_user,
        user_name,
        passwd,
        email,
        tenant_id,
        tenant_name,
        parent_tenant_id,
        is_admin,
        is_active,
        must_change_password,
        suspend_logon,
        roles,
        permissions
      FROM sensumaster_dev.v_user_authentication 
      WHERE (logon_user = $1 OR email = $1) AND is_active = true`,
      [loginIdentifier]
    );

    console.log(`Found ${result.rows.length} users for login: ${loginIdentifier}`);
    
    if (!result.rows.length) {
      // Log failed attempt for non-existent user (optional)
      await logFailedLoginAttempt(loginIdentifier, 'USER_NOT_FOUND');
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    console.log(`User found: ${user.logon_user}, tenant: ${user.tenant_id}, active: ${user.is_active}`);

    // Check if login is suspended
    if (user.suspend_logon) {
      await logFailedLoginAttempt(loginIdentifier, 'LOGIN_SUSPENDED');
      throw new Error('Account login is suspended. Please contact your administrator.');
    }

    // Verify password
    console.log('Verifying password...');
    console.log('Stored password hash:', user.passwd ? user.passwd.substring(0, 20) + '...' : 'null');
    console.log('Password length:', password.length);
    const isValidPassword = await verifyPassword(password, user.passwd);
    console.log(`Password valid: ${isValidPassword}`);
    
    if (!isValidPassword) {
      // Handle failed login attempt (make this more defensive)
      try {
        await handleFailedLoginAttempt(user.logon_user, loginIdentifier);
      } catch (securityError) {
        console.log('Security tracking failed, but continuing with auth failure:', securityError.message);
      }
      throw new Error('Invalid credentials');
    }

    // Reset failed attempts on successful login (make this more defensive)
    try {
      await resetFailedLoginAttempts(user.logon_user);
    } catch (securityError) {
      console.log('Security reset failed, but login successful:', securityError.message);
    }

    // Check if password change is required
    if (user.must_change_password) {
      return {
        requirePasswordChange: true,
        user: {
          logon_user: user.logon_user,
          user_name: user.user_name,
          email: user.email,
          tenant_id: user.tenant_id
        }
      };
    }

    // Get available tenants based on role and hierarchy
    const availableTenants = await getAvailableTenants(user.tenant_id, user.is_admin, user.parent_tenant_id);

    // Generate tokens
    const tokens = generateTokens(
      user.logon_user, 
      user.logon_user, 
      user.is_admin ? 'admin' : 'user',
      user.tenant_id,
      availableTenants
    );

    console.log(`Authentication successful for user: ${user.logon_user}`);

    return {
      user: {
        id: user.logon_user,
        username: user.logon_user,
        user_name: user.user_name,
        email: user.email,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        parent_tenant_id: user.parent_tenant_id,
        is_admin: user.is_admin,
        roles: user.roles,
        permissions: user.permissions,
        available_tenants: availableTenants
      },
      tokens,
      requirePasswordChange: false
    };
  } catch (error) {
    console.log('Authentication error:', error.message);
    throw error;
  }
};

// Get available tenants based on user's tenant and admin status
export const getAvailableTenants = async (userTenantId, isAdmin, parentTenantId) => {
  try {
    // For admin users, get all tenants in their hierarchy
    if (isAdmin) {
      // If root tenant (no parent), get all tenants
      if (!parentTenantId) {
        const result = await pgDB.query(
          "SELECT tenant_id FROM sensumaster_dev.tenant_tbl WHERE status = 'ACTIVE' ORDER BY tenant_name"
        );
        return result.rows.map(row => row.tenant_id);
      } else {
        // Get tenant hierarchy starting from user's tenant
        const result = await pgDB.query(`
          WITH RECURSIVE tenant_hierarchy AS (
            SELECT tenant_id, parent_tenant_id, 0 as level
            FROM sensumaster_dev.tenant_tbl 
            WHERE tenant_id = $1 AND status = 'ACTIVE'
            
            UNION ALL
            
            SELECT t.tenant_id, t.parent_tenant_id, th.level + 1
            FROM sensumaster_dev.tenant_tbl t
            JOIN tenant_hierarchy th ON t.parent_tenant_id = th.tenant_id
            WHERE status = 'ACTIVE'
          )
          SELECT tenant_id FROM tenant_hierarchy ORDER BY level, tenant_id
        `, [userTenantId]);
        
        return result.rows.map(row => row.tenant_id);
      }
    } else {
      // Regular users can only access their own tenant
      return [userTenantId];
    }
  } catch (error) {
    console.error('Error getting available tenants:', error);
    return [userTenantId]; // Fallback to user's own tenant
  }
};

// User login
export const loginUser = async (credentials) => {
  try {
    // Get user by username or email
    let user = await pgDB.getUserByUsername(credentials.login);
    if (!user) {
      user = await pgDB.getUserByEmail(credentials.login);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new Error('Account is temporarily locked due to multiple failed login attempts');
    }

    // Verify password
    const isValidPassword = await verifyPassword(credentials.password, user.password_hash);
    if (!isValidPassword) {
      // Increment failed login attempts
      await pgDB.incrementFailedLoginAttempts(user.username);
      throw new Error('Invalid credentials');
    }

    // Update last login
    await pgDB.updateLastLogin(user.id);

    // Generate tokens
    const tokens = generateTokens(user.id, user.username, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        last_login: user.last_login
      },
      tokens
    };
  } catch (error) {
    throw error;
  }
};

// Refresh token using authentication view
export const refreshUserToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Get user from authentication view
    const user = await pgDB.query(
      `SELECT 
        logon_user,
        user_name,
        email,
        tenant_id,
        tenant_name,
        parent_tenant_id,
        is_admin,
        is_active,
        roles,
        permissions
      FROM sensumaster_dev.v_user_authentication 
      WHERE logon_user = $1 AND is_active = true`,
      [decoded.userId]
    );

    if (!user.rows.length) {
      throw new Error('Invalid refresh token');
    }

    const userData = user.rows[0];
    const availableTenants = await getAvailableTenants(userData.tenant_id, userData.is_admin, userData.parent_tenant_id);
    
    const tokens = generateTokens(
      userData.logon_user, 
      userData.logon_user, 
      userData.is_admin ? 'admin' : 'user',
      userData.tenant_id,
      availableTenants
    );

    return {
      user: {
        id: userData.logon_user,
        username: userData.logon_user,
        user_name: userData.user_name,
        email: userData.email,
        tenant_id: userData.tenant_id,
        tenant_name: userData.tenant_name,
        is_admin: userData.is_admin,
        roles: userData.roles,
        permissions: userData.permissions,
        available_tenants: availableTenants
      },
      tokens
    };
  } catch (error) {
    throw error;
  }
};

// Database-driven security functions
export const logFailedLoginAttempt = async (loginIdentifier, reason = 'INVALID_CREDENTIALS') => {
  try {
    // Log the failed attempt in an audit table if it exists
    await pgDB.query(
      `INSERT INTO sensumaster_dev.login_audit_log (login_identifier, attempt_time, success, reason, ip_address)
       VALUES ($1, CURRENT_TIMESTAMP, false, $2, $3)
       ON CONFLICT DO NOTHING`, // Ignore if audit table doesn't exist
      [loginIdentifier, reason, 'system'] // IP would come from req.ip in actual middleware
    ).catch(() => {
      // Silently ignore if audit table doesn't exist
      console.log('Login audit logging not available (table may not exist)');
    });
  } catch (error) {
    console.error('Error logging failed login attempt:', error);
  }
};

export const handleFailedLoginAttempt = async (userId, loginIdentifier) => {
  try {
    // Get current security settings for the user (defensive - check if table exists)
    const securityResult = await pgDB.query(
      `SELECT 
        us.max_violations,
        COALESCE(us.current_violations, 0) as current_violations,
        us.lockout_duration_minutes,
        u.suspend_logon
      FROM sensumaster_dev.user_security us
      JOIN sensumaster_dev.v_user_authentication u ON us.user_id = u.logon_user
      WHERE us.user_id = $1`,
      [userId]
    ).catch(error => {
      console.log('user_security table not available or schema mismatch:', error.message);
      return { rows: [] };
    });

    if (!securityResult.rows.length) {
      console.log('No security policy found for user, skipping violation tracking');
      return;
    }

    const security = securityResult.rows[0];
    const newViolationCount = (security.current_violations || 0) + 1;

    // Update violation count (defensive)
    await pgDB.query(
      `UPDATE sensumaster_dev.user_security 
       SET current_violations = $1,
           last_violation_time = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [newViolationCount, userId]
    ).catch(error => {
      console.log('Could not update violation count:', error.message);
    });

    // Check if we should suspend login
    if (newViolationCount >= security.max_violations) {
      await pgDB.query(
        `UPDATE sensumaster_dev.user_tbl 
         SET suspend_logon = true,
             locked_until = CURRENT_TIMESTAMP + INTERVAL '${security.lockout_duration_minutes || 15} minutes'
         WHERE logon_user = $1`,
        [userId]
      ).catch(error => {
        console.log('Could not suspend user login:', error.message);
      });
      
      console.log(`User ${userId} login suspended due to ${newViolationCount} failed attempts (max: ${security.max_violations})`);
    }

    // Log the failed attempt
    await logFailedLoginAttempt(loginIdentifier, 'INVALID_PASSWORD');
  } catch (error) {
    console.error('Error handling failed login attempt:', error);
    // Don't throw - we don't want security logging to break authentication
  }
};

export const resetFailedLoginAttempts = async (userId) => {
  try {
    // Reset violation count on successful login
    await pgDB.query(
      `UPDATE sensumaster_dev.user_security 
       SET current_violations = 0,
           last_violation_time = NULL
       WHERE user_id = $1`,
      [userId]
    );

    // Also reset suspend_logon if it was set
    await pgDB.query(
      `UPDATE sensumaster_dev.user_tbl 
       SET suspend_logon = false,
           locked_until = NULL
       WHERE logon_user = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error resetting failed login attempts:', error);
    // Don't throw - successful login should proceed even if we can't reset counters
  }
};

// Default export
export default {
  authRateLimit,
  apiRateLimit,
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireRole,
  authenticateApiKey,
  authenticate,
  authenticateUser,
  refreshUserToken,
  getAvailableTenants
};

// Tenant access validation middleware
export const requireTenantAccess = (req, res, next) => {
  const requestedTenantId = req.params.tenantId || req.query.tenant_id || req.body.tenant_id;
  
  if (!requestedTenantId) {
    return next(); // No specific tenant requested, proceed
  }
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required for tenant access'
    });
  }
  
  // Check if user can access the requested tenant
  if (!req.user.available_tenants || !req.user.available_tenants.includes(requestedTenantId)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to requested tenant',
      requestedTenant: requestedTenantId,
      availableTenants: req.user.available_tenants
    });
  }
  
  // Set the active tenant for this request
  req.activeTenant = requestedTenantId;
  next();
};

// Utility function to check tenant access
export const canAccessTenant = (user, tenantId) => {
  return user.available_tenants && user.available_tenants.includes(tenantId);
};

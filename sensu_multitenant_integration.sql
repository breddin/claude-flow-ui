-- ==================================================
-- MULTI-TENANT INTEGRATION FOR EXISTING SENSU DATABASE
-- Database: sensuresearch, Schema: sensumaster_dev
-- Bcrypt Salt: "visualizehr_salt"
-- ==================================================

-- Set the correct schema
SET search_path TO sensumaster_dev, public;

-- ==================================================
-- PART A: INSPECT EXISTING MIGRATED TABLES
-- ==================================================

-- Check what tenant tables we have
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'sensumaster_dev' 
  AND table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments')
ORDER BY table_name, ordinal_position;

-- Check tenant data
SELECT tenant_id, tenant_name, parent_tenant_id, is_active 
FROM tenant_tbl 
ORDER BY tenant_name;

-- Check user data sample
SELECT user_id, username, tenant_id, is_active, created_date
FROM user_security 
LIMIT 10;

-- ==================================================
-- PART B: CREATE CLAUDE-FLOW-UI TABLES WITH TENANT SUPPORT
-- ==================================================

-- Create users table compatible with sensu multi-tenant structure
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  tenant_id VARCHAR(100) NOT NULL,
  available_tenants TEXT[],
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key to sensu tenant table
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_available_tenants ON users USING GIN(available_tenants);

-- Create agents table with tenant support
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'idle',
  config JSONB DEFAULT '{}',
  user_id INTEGER NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_agents_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_agents_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Create memories table with tenant support
CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER,
  user_id INTEGER NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  content_vector TSVECTOR,
  metadata JSONB DEFAULT '{}',
  importance_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_memories_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
  CONSTRAINT fk_memories_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_memories_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_tenant_id ON memories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memories_content_vector ON memories USING GIN(content_vector);

-- Create interactions table with tenant support
CREATE TABLE IF NOT EXISTS interactions (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER,
  user_id INTEGER NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  input TEXT,
  output TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_interactions_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
  CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_interactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_interactions_agent_id ON interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant_id ON interactions(tenant_id);

-- Create orchestration_sessions table with tenant support
CREATE TABLE IF NOT EXISTS orchestration_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON orchestration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_id ON orchestration_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON orchestration_sessions(session_id);

-- Create api_keys table with tenant support
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  key_hash TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_api_keys_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- Create audit_logs table with tenant support
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  tenant_id VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ==================================================
-- PART C: CREATE TENANT HIERARCHY FUNCTIONS
-- ==================================================

-- Function to get tenant hierarchy
CREATE OR REPLACE FUNCTION get_tenant_hierarchy(tenant_id VARCHAR(100))
RETURNS TABLE(
  child_tenant_id VARCHAR(100),
  tenant_name VARCHAR(255),
  level INTEGER
) AS $$
WITH RECURSIVE tenant_tree AS (
  -- Start with the given tenant
  SELECT 
    t.tenant_id,
    t.tenant_name,
    0 as level
  FROM tenant_tbl t 
  WHERE t.tenant_id = $1
  
  UNION ALL
  
  -- Get all child tenants recursively
  SELECT 
    t.tenant_id,
    t.tenant_name,
    tt.level + 1
  FROM tenant_tbl t
  JOIN tenant_tree tt ON t.parent_tenant_id = tt.tenant_id
)
SELECT tenant_id, tenant_name, level FROM tenant_tree ORDER BY level, tenant_name;
$$ LANGUAGE SQL;

-- Function to get available tenants for a user based on role and tenant
CREATE OR REPLACE FUNCTION get_available_tenants(user_tenant_id VARCHAR(100), user_role VARCHAR(50))
RETURNS TEXT[] AS $$
DECLARE
  available_tenants TEXT[];
BEGIN
  -- For admin users in visualizehr (root), they can access all tenants
  IF user_role IN ('admin', 'super_admin') AND user_tenant_id = 'visualizehr' THEN
    SELECT ARRAY_AGG(tenant_id) INTO available_tenants
    FROM tenant_tbl 
    WHERE is_active = true;
  
  -- For admin users in other tenants, they can access their hierarchy
  ELSIF user_role IN ('admin', 'tenant_admin') THEN
    SELECT ARRAY_AGG(child_tenant_id) INTO available_tenants
    FROM get_tenant_hierarchy(user_tenant_id);
    
  -- Regular users can only access their own tenant
  ELSE
    available_tenants := ARRAY[user_tenant_id];
  END IF;
  
  RETURN COALESCE(available_tenants, ARRAY[user_tenant_id]);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can access a specific tenant
CREATE OR REPLACE FUNCTION can_access_tenant(user_id INTEGER, requested_tenant_id VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
  user_available_tenants TEXT[];
BEGIN
  SELECT available_tenants INTO user_available_tenants
  FROM users 
  WHERE id = user_id AND is_active = true;
  
  RETURN requested_tenant_id = ANY(user_available_tenants);
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- PART D: BCRYPT PASSWORD HASHING FUNCTION WITH VISUALIZEHR_SALT
-- ==================================================

-- Function to hash password with visualizehr_salt
CREATE OR REPLACE FUNCTION hash_password_with_salt(plain_password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- In a real implementation, you'd use a proper bcrypt function
  -- For now, we'll create a placeholder that indicates the salt is appended
  RETURN '$2b$12$' || encode(digest(plain_password || 'visualizehr_salt', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- PART E: CREATE TEST USERS WITH PROPER TENANT STRUCTURE
-- ==================================================

-- Create test users based on existing tenant structure
DO $$
DECLARE
  bennie_id INTEGER;
  jeremy_id INTEGER;
  demo_id INTEGER;
  visualizehr_exists BOOLEAN := false;
  coligos_exists BOOLEAN := false;
BEGIN
  -- Check if our expected tenants exist
  SELECT EXISTS(SELECT 1 FROM tenant_tbl WHERE tenant_id = 'visualizehr') INTO visualizehr_exists;
  SELECT EXISTS(SELECT 1 FROM tenant_tbl WHERE tenant_id = 'coligos') INTO coligos_exists;
  
  -- Create root admin user (Bennie) if visualizehr exists
  IF visualizehr_exists THEN
    INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
    VALUES (
      'bennie',
      'bennie@visualizehr.com', 
      hash_password_with_salt('password'),
      'admin',
      'visualizehr',
      get_available_tenants('visualizehr', 'admin'),
      true
    ) 
    ON CONFLICT (username) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      available_tenants = EXCLUDED.available_tenants,
      role = EXCLUDED.role,
      password_hash = EXCLUDED.password_hash
    RETURNING id INTO bennie_id;
    
    RAISE NOTICE 'Created/Updated Bennie (ID: %) for tenant visualizehr', bennie_id;
  ELSE
    RAISE NOTICE 'Tenant visualizehr not found, skipping Bennie creation';
  END IF;
  
  -- Create tenant admin user (Jeremy) if coligos exists
  IF coligos_exists THEN
    INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
    VALUES (
      'jeremy',
      'jeremy@coligos.com',
      hash_password_with_salt('password'),
      'admin',
      'coligos',
      get_available_tenants('coligos', 'admin'),
      true
    )
    ON CONFLICT (username) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      available_tenants = EXCLUDED.available_tenants,
      role = EXCLUDED.role,
      password_hash = EXCLUDED.password_hash
    RETURNING id INTO jeremy_id;
    
    RAISE NOTICE 'Created/Updated Jeremy (ID: %) for tenant coligos', jeremy_id;
  ELSE
    RAISE NOTICE 'Tenant coligos not found, skipping Jeremy creation';
  END IF;
  
  -- Create demo user with first available tenant
  INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
  VALUES (
    'demo',
    'demo@example.com',
    hash_password_with_salt('demo'),
    'user', 
    (SELECT tenant_id FROM tenant_tbl WHERE is_active = true LIMIT 1),
    ARRAY[(SELECT tenant_id FROM tenant_tbl WHERE is_active = true LIMIT 1)],
    true
  )
  ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    available_tenants = EXCLUDED.available_tenants
  RETURNING id INTO demo_id;
  
  RAISE NOTICE 'Created/Updated Demo user (ID: %)', demo_id;
END $$;

-- ==================================================
-- PART F: VERIFICATION QUERIES
-- ==================================================

-- Check available tenants
SELECT 
  tenant_id,
  tenant_name,
  parent_tenant_id,
  is_active,
  created_date
FROM tenant_tbl
WHERE is_active = true
ORDER BY 
  CASE WHEN parent_tenant_id IS NULL THEN 0 ELSE 1 END,
  tenant_name;

-- Check created users with their tenant access
SELECT 
  u.id,
  u.username,
  u.email,
  u.role,
  u.tenant_id as primary_tenant,
  t.tenant_name as primary_tenant_name,
  array_length(u.available_tenants, 1) as accessible_tenant_count,
  u.available_tenants,
  u.is_active
FROM users u
JOIN tenant_tbl t ON u.tenant_id = t.tenant_id
ORDER BY u.role DESC, u.username;

-- Test tenant access for created users
SELECT 
  u.username,
  u.tenant_id as user_tenant,
  'visualizehr' as test_tenant,
  can_access_tenant(u.id, 'visualizehr') as can_access_visualizehr,
  'coligos' as test_tenant2,  
  can_access_tenant(u.id, 'coligos') as can_access_coligos
FROM users u
WHERE u.tenant_id IS NOT NULL;

-- Show tenant hierarchy examples
SELECT 
  'Tenant Hierarchy for visualizehr' as info,
  child_tenant_id,
  tenant_name,
  level
FROM get_tenant_hierarchy('visualizehr')
UNION ALL
SELECT 
  'Tenant Hierarchy for coligos' as info,
  child_tenant_id,
  tenant_name,
  level
FROM get_tenant_hierarchy('coligos')
ORDER BY info, level, tenant_name;

-- ==================================================
-- EXECUTION COMPLETE
-- ==================================================
RAISE NOTICE 'Multi-tenant integration complete!';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Update AuthService.js to use tenant_id and bcrypt with visualizehr_salt';
RAISE NOTICE '2. Update all API routes to filter by accessible tenants';
RAISE NOTICE '3. Test authentication with created users';

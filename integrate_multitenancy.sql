-- ==================================================
-- MULTI-TENANT INTEGRATION FOR CLAUDE-FLOW-UI
-- This script integrates existing sensu multi-tenant tables 
-- with your current Week 2 authentication implementation
-- ==================================================

-- ==================================================
-- PART A: UNDERSTAND EXISTING TENANT STRUCTURE
-- ==================================================

-- First, let's see what tenant data we have
SELECT 
  t.tenant_id,
  t.tenant_name,
  t.parent_tenant_id,
  COUNT(DISTINCT us.user_id) as user_count,
  COUNT(DISTINCT ur.role_id) as role_count
FROM sensumaster_dev.tenant_tbl t
LEFT JOIN sensumaster_dev.user_security us ON t.tenant_id = us.tenant_id
LEFT JOIN sensumaster_dev.user_roles ur ON ur.tenant_id = t.tenant_id  
GROUP BY t.tenant_id, t.tenant_name, t.parent_tenant_id
ORDER BY t.tenant_name;

-- ==================================================
-- PART B: MODIFY EXISTING CLAUDE-FLOW-UI USERS TABLE
-- ==================================================

-- Add tenant support to your existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_tenants TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_tenant_id VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_available_tenants ON users USING GIN(available_tenants);

-- ==================================================
-- PART C: CREATE TENANT HIERARCHY VIEW
-- ==================================================

-- Create a view to understand tenant hierarchy from sensu data
CREATE OR REPLACE VIEW tenant_hierarchy_view AS
WITH RECURSIVE tenant_tree AS (
  -- Root tenants (no parent)
  SELECT 
    tenant_id,
    tenant_name,
    parent_tenant_id,
    0 as level,
    ARRAY[tenant_id] as hierarchy_path,
    tenant_id as root_tenant
  FROM sensumaster_dev.tenant_tbl 
  WHERE parent_tenant_id IS NULL
  
  UNION ALL
  
  -- Child tenants
  SELECT 
    t.tenant_id,
    t.tenant_name,
    t.parent_tenant_id,
    tt.level + 1,
    tt.hierarchy_path || t.tenant_id,
    tt.root_tenant
  FROM sensumaster_dev.tenant_tbl t
  JOIN tenant_tree tt ON t.parent_tenant_id = tt.tenant_id
)
SELECT 
  tenant_id,
  tenant_name,
  parent_tenant_id,
  level,
  hierarchy_path,
  root_tenant,
  -- Calculate available tenants (self + all children)
  ARRAY(
    SELECT DISTINCT unnest(hierarchy_path) 
    FROM tenant_tree sub 
    WHERE sub.hierarchy_path @> ARRAY[tenant_tree.tenant_id]
  ) as available_tenants
FROM tenant_tree
ORDER BY level, tenant_name;

-- ==================================================
-- PART D: MIGRATE SENSU USERS TO CLAUDE-FLOW USERS
-- ==================================================

-- Create a staging table to map sensu users to claude-flow users
CREATE TABLE IF NOT EXISTS user_migration_staging (
  sensu_user_id VARCHAR(100),
  claude_user_id INTEGER,
  tenant_id VARCHAR(100),
  username VARCHAR(100),
  email VARCHAR(255),
  role VARCHAR(50),
  available_tenants TEXT[],
  migration_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Populate staging table with sensu user data
INSERT INTO user_migration_staging (
  sensu_user_id, 
  tenant_id, 
  username, 
  email, 
  role,
  available_tenants
)
SELECT DISTINCT
  us.user_id as sensu_user_id,
  us.tenant_id,
  us.username,
  ue.email_address as email,
  COALESCE(ur.role_name, 'user') as role,
  th.available_tenants
FROM sensumaster_dev.user_security us
LEFT JOIN sensumaster_dev.user_emails ue ON us.user_id = ue.user_id AND ue.is_primary = true
LEFT JOIN sensumaster_dev.user_role_assignments ura ON us.user_id = ura.user_id
LEFT JOIN sensumaster_dev.user_roles ur ON ura.role_id = ur.role_id
LEFT JOIN tenant_hierarchy_view th ON us.tenant_id = th.tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_migration_staging ums 
  WHERE ums.sensu_user_id = us.user_id
);

-- ==================================================
-- PART E: CREATE MIGRATION FUNCTIONS
-- ==================================================

-- Function to get available tenants for a user based on hierarchy
CREATE OR REPLACE FUNCTION get_available_tenants(user_tenant_id VARCHAR(100), user_role VARCHAR(50))
RETURNS TEXT[] AS $$
DECLARE
  available_tenants TEXT[];
BEGIN
  -- For admin users, get all tenants in their hierarchy
  IF user_role IN ('admin', 'super_admin') THEN
    SELECT th.available_tenants INTO available_tenants
    FROM tenant_hierarchy_view th
    WHERE th.tenant_id = user_tenant_id;
    
    -- If no hierarchy found, just return their own tenant
    IF available_tenants IS NULL THEN
      available_tenants := ARRAY[user_tenant_id];
    END IF;
  ELSE
    -- Regular users can only access their own tenant
    available_tenants := ARRAY[user_tenant_id];
  END IF;
  
  RETURN available_tenants;
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
  WHERE id = user_id;
  
  RETURN requested_tenant_id = ANY(user_available_tenants);
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- PART F: UPDATE EXISTING CLAUDE-FLOW TABLES FOR MULTI-TENANCY
-- ==================================================

-- Add tenant_id to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_id ON agents(tenant_id);

-- Add tenant_id to memories table  
ALTER TABLE memories ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_memories_tenant_id ON memories(tenant_id);

-- Add tenant_id to interactions table
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant_id ON interactions(tenant_id);

-- Add tenant_id to orchestration_sessions table
ALTER TABLE orchestration_sessions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_orchestration_sessions_tenant_id ON orchestration_sessions(tenant_id);

-- ==================================================
-- PART G: SAMPLE TENANT USERS FOR TESTING
-- ==================================================

-- Create sample tenant users based on unified auth design
DO $$
DECLARE
  bennie_id INTEGER;
  jeremy_id INTEGER;
  demo_id INTEGER;
BEGIN
  -- Create root admin user (Bennie) - can access all tenants
  INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
  VALUES (
    'bennie',
    'bennie@visualizehr.com', 
    '$2b$12$placeholder.hash.here', -- You'll need to hash 'password'
    'admin',
    'visualizehr',
    (SELECT available_tenants FROM tenant_hierarchy_view WHERE tenant_id = 'visualizehr'),
    true
  ) 
  ON CONFLICT (username) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    available_tenants = EXCLUDED.available_tenants,
    role = EXCLUDED.role
  RETURNING id INTO bennie_id;
  
  -- Create tenant admin user (Jeremy) - can access coligos hierarchy
  INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
  VALUES (
    'jeremy',
    'jeremy@coligos.com',
    '$2b$12$placeholder.hash.here', -- You'll need to hash 'password'  
    'admin',
    'coligos',
    (SELECT available_tenants FROM tenant_hierarchy_view WHERE tenant_id = 'coligos'),
    true
  )
  ON CONFLICT (username) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    available_tenants = EXCLUDED.available_tenants,
    role = EXCLUDED.role
  RETURNING id INTO jeremy_id;
  
  -- Create demo user - limited to demo tenant
  INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
  VALUES (
    'demo',
    'demo@demo-tenant.com',
    '$2b$12$placeholder.hash.here', -- You'll need to hash 'password'
    'user', 
    'demo-tenant',
    ARRAY['demo-tenant'],
    true
  )
  ON CONFLICT (username) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    available_tenants = EXCLUDED.available_tenants,
    role = EXCLUDED.role
  RETURNING id INTO demo_id;
  
  RAISE NOTICE 'Created/Updated users: Bennie (%), Jeremy (%), Demo (%)', bennie_id, jeremy_id, demo_id;
END $$;

-- ==================================================
-- PART H: VERIFICATION QUERIES
-- ==================================================

-- Check tenant hierarchy
SELECT 
  tenant_id,
  tenant_name,
  level,
  array_length(available_tenants, 1) as accessible_tenant_count,
  available_tenants
FROM tenant_hierarchy_view
ORDER BY level, tenant_name;

-- Check migrated users
SELECT 
  id,
  username,
  email,
  role,
  tenant_id,
  array_length(available_tenants, 1) as accessible_tenant_count,
  available_tenants
FROM users 
WHERE tenant_id IS NOT NULL
ORDER BY role DESC, username;

-- Test tenant access function
SELECT 
  u.username,
  u.tenant_id as user_tenant,
  'visualizehr' as test_tenant,
  can_access_tenant(u.id, 'visualizehr') as can_access_visualizehr,
  'coligos' as test_tenant2,  
  can_access_tenant(u.id, 'coligos') as can_access_coligos
FROM users u
WHERE u.tenant_id IS NOT NULL;

-- ==================================================
-- EXECUTION INSTRUCTIONS:
-- ==================================================
-- 1. First run inspect_and_migrate_safely.sql to copy tenant tables
-- 2. Then run this script to integrate multi-tenancy
-- 3. Update your AuthService.js to use tenant_id and available_tenants
-- 4. Test with the sample users created
-- ==================================================

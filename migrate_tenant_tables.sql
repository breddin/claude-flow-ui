-- ==================================================
-- Multi-Tenant Database Migration Script
-- Source: sensumaster schema
-- Target: sensumaster_dev schema
-- Tables: tenant_tbl, user_security, user_emails, user_roles, user_role_assignments
-- ==================================================

-- Set schema search path for consistency
SET search_path TO sensumaster_dev, sensumaster, public;

-- ==================================================
-- 1. TENANT_TBL - Core tenant information
-- ==================================================

-- Drop existing table if it exists (be careful in production!)
DROP TABLE IF EXISTS sensumaster_dev.tenant_tbl CASCADE;

-- Create table structure from source
CREATE TABLE sensumaster_dev.tenant_tbl AS 
SELECT * FROM sensumaster.tenant_tbl WHERE 1=0;

-- Add any constraints, indexes, and sequences that weren't copied
-- (You may need to adjust these based on your actual schema)

-- Primary key
ALTER TABLE sensumaster_dev.tenant_tbl 
ADD CONSTRAINT tenant_tbl_pkey PRIMARY KEY (tenant_id);

-- Copy data
INSERT INTO sensumaster_dev.tenant_tbl 
SELECT * FROM sensumaster.tenant_tbl;

-- ==================================================
-- 2. USER_SECURITY - User authentication data
-- ==================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS sensumaster_dev.user_security CASCADE;

-- Create table structure
CREATE TABLE sensumaster_dev.user_security AS 
SELECT * FROM sensumaster.user_security WHERE 1=0;

-- Add constraints
ALTER TABLE sensumaster_dev.user_security 
ADD CONSTRAINT user_security_pkey PRIMARY KEY (user_id);

-- Add foreign key to tenant if applicable
-- ALTER TABLE sensumaster_dev.user_security 
-- ADD CONSTRAINT fk_user_security_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES sensumaster_dev.tenant_tbl(tenant_id);

-- Copy data
INSERT INTO sensumaster_dev.user_security 
SELECT * FROM sensumaster.user_security;

-- ==================================================
-- 3. USER_EMAILS - User email management
-- ==================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS sensumaster_dev.user_emails CASCADE;

-- Create table structure
CREATE TABLE sensumaster_dev.user_emails AS 
SELECT * FROM sensumaster.user_emails WHERE 1=0;

-- Add constraints (adjust based on your schema)
-- ALTER TABLE sensumaster_dev.user_emails 
-- ADD CONSTRAINT user_emails_pkey PRIMARY KEY (email_id);

-- Add foreign key constraints
-- ALTER TABLE sensumaster_dev.user_emails 
-- ADD CONSTRAINT fk_user_emails_user 
-- FOREIGN KEY (user_id) REFERENCES sensumaster_dev.user_security(user_id);

-- Copy data
INSERT INTO sensumaster_dev.user_emails 
SELECT * FROM sensumaster.user_emails;

-- ==================================================
-- 4. USER_ROLES - Role definitions
-- ==================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS sensumaster_dev.user_roles CASCADE;

-- Create table structure
CREATE TABLE sensumaster_dev.user_roles AS 
SELECT * FROM sensumaster.user_roles WHERE 1=0;

-- Add constraints
-- ALTER TABLE sensumaster_dev.user_roles 
-- ADD CONSTRAINT user_roles_pkey PRIMARY KEY (role_id);

-- Copy data
INSERT INTO sensumaster_dev.user_roles 
SELECT * FROM sensumaster.user_roles;

-- ==================================================
-- 5. USER_ROLE_ASSIGNMENTS - User-Role mappings
-- ==================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS sensumaster_dev.user_role_assignments CASCADE;

-- Create table structure
CREATE TABLE sensumaster_dev.user_role_assignments AS 
SELECT * FROM sensumaster.user_role_assignments WHERE 1=0;

-- Add constraints
-- ALTER TABLE sensumaster_dev.user_role_assignments 
-- ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (assignment_id);

-- Add foreign key constraints
-- ALTER TABLE sensumaster_dev.user_role_assignments 
-- ADD CONSTRAINT fk_assignment_user 
-- FOREIGN KEY (user_id) REFERENCES sensumaster_dev.user_security(user_id);

-- ALTER TABLE sensumaster_dev.user_role_assignments 
-- ADD CONSTRAINT fk_assignment_role 
-- FOREIGN KEY (role_id) REFERENCES sensumaster_dev.user_roles(role_id);

-- Copy data
INSERT INTO sensumaster_dev.user_role_assignments 
SELECT * FROM sensumaster.user_role_assignments;

-- ==================================================
-- 6. RECREATE INDEXES (if they exist in source)
-- ==================================================

-- Example indexes - adjust based on your actual schema
-- CREATE INDEX idx_tenant_tbl_name ON sensumaster_dev.tenant_tbl(tenant_name);
-- CREATE INDEX idx_user_security_username ON sensumaster_dev.user_security(username);
-- CREATE INDEX idx_user_security_tenant ON sensumaster_dev.user_security(tenant_id);
-- CREATE INDEX idx_user_emails_email ON sensumaster_dev.user_emails(email_address);
-- CREATE INDEX idx_user_role_assignments_user ON sensumaster_dev.user_role_assignments(user_id);
-- CREATE INDEX idx_user_role_assignments_role ON sensumaster_dev.user_role_assignments(role_id);

-- ==================================================
-- 7. VERIFY DATA COPY
-- ==================================================

-- Check row counts match
SELECT 'tenant_tbl' as table_name, 
       (SELECT COUNT(*) FROM sensumaster.tenant_tbl) as source_count,
       (SELECT COUNT(*) FROM sensumaster_dev.tenant_tbl) as target_count;

SELECT 'user_security' as table_name,
       (SELECT COUNT(*) FROM sensumaster.user_security) as source_count,
       (SELECT COUNT(*) FROM sensumaster_dev.user_security) as target_count;

SELECT 'user_emails' as table_name,
       (SELECT COUNT(*) FROM sensumaster.user_emails) as source_count,
       (SELECT COUNT(*) FROM sensumaster_dev.user_emails) as target_count;

SELECT 'user_roles' as table_name,
       (SELECT COUNT(*) FROM sensumaster.user_roles) as source_count,
       (SELECT COUNT(*) FROM sensumaster_dev.user_roles) as target_count;

SELECT 'user_role_assignments' as table_name,
       (SELECT COUNT(*) FROM sensumaster.user_role_assignments) as source_count,
       (SELECT COUNT(*) FROM sensumaster_dev.user_role_assignments) as target_count;

-- ==================================================
-- 8. ADDITIONAL SETUP (Optional)
-- ==================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sensumaster_dev TO claude_admin;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sensumaster_dev TO claude_admin;

-- Update sequence values if auto-increment columns exist
-- SELECT setval('sensumaster_dev.tenant_tbl_id_seq', 
--               (SELECT MAX(tenant_id) FROM sensumaster_dev.tenant_tbl));

COMMIT;

-- ==================================================
-- EXECUTION NOTES:
-- ==================================================
-- 1. Review and uncomment constraint additions based on your actual schema
-- 2. Adjust primary key and foreign key definitions as needed
-- 3. Add any missing indexes from the source schema
-- 4. Test thoroughly in development before running in production
-- 5. Consider backing up target schema before running this script
-- ==================================================

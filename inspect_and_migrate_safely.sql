-- ==================================================
-- STEP 1: INSPECT SOURCE SCHEMA FIRST
-- Run these queries to understand the source table structures
-- ==================================================

-- Get table structures
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'sensumaster' 
  AND table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments')
ORDER BY table_name, ordinal_position;

-- Get primary keys
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'sensumaster' 
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments');

-- Get foreign keys
SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'sensumaster' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments');

-- Get indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'sensumaster' 
  AND tablename IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments');

-- ==================================================
-- STEP 2: CREATE SCHEMAS IF NEEDED
-- ==================================================

-- Create target schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS sensumaster_dev;

-- ==================================================
-- STEP 3: SAFER TABLE REPLICATION WITH STRUCTURE PRESERVATION
-- ==================================================

-- Use pg_dump-style approach for exact structure replication
-- Run these commands one by one and adjust as needed

-- For tenant_tbl
DROP TABLE IF EXISTS sensumaster_dev.tenant_tbl CASCADE;
CREATE TABLE sensumaster_dev.tenant_tbl (LIKE sensumaster.tenant_tbl INCLUDING ALL);
INSERT INTO sensumaster_dev.tenant_tbl SELECT * FROM sensumaster.tenant_tbl;

-- For user_security  
DROP TABLE IF EXISTS sensumaster_dev.user_security CASCADE;
CREATE TABLE sensumaster_dev.user_security (LIKE sensumaster.user_security INCLUDING ALL);
INSERT INTO sensumaster_dev.user_security SELECT * FROM sensumaster.user_security;

-- For user_emails
DROP TABLE IF EXISTS sensumaster_dev.user_emails CASCADE;
CREATE TABLE sensumaster_dev.user_emails (LIKE sensumaster.user_emails INCLUDING ALL);
INSERT INTO sensumaster_dev.user_emails SELECT * FROM sensumaster.user_emails;

-- For user_roles
DROP TABLE IF EXISTS sensumaster_dev.user_roles CASCADE;
CREATE TABLE sensumaster_dev.user_roles (LIKE sensumaster.user_roles INCLUDING ALL);
INSERT INTO sensumaster_dev.user_roles SELECT * FROM sensumaster.user_roles;

-- For user_role_assignments
DROP TABLE IF EXISTS sensumaster_dev.user_role_assignments CASCADE;
CREATE TABLE sensumaster_dev.user_role_assignments (LIKE sensumaster.user_role_assignments INCLUDING ALL);
INSERT INTO sensumaster_dev.user_role_assignments SELECT * FROM sensumaster.user_role_assignments;

-- ==================================================
-- STEP 4: VERIFY REPLICATION
-- ==================================================

-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'sensumaster_dev' 
  AND table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments');

-- Verify row counts
SELECT 
  'tenant_tbl' as table_name,
  (SELECT COUNT(*) FROM sensumaster.tenant_tbl) as source_rows,
  (SELECT COUNT(*) FROM sensumaster_dev.tenant_tbl) as target_rows,
  CASE WHEN (SELECT COUNT(*) FROM sensumaster.tenant_tbl) = (SELECT COUNT(*) FROM sensumaster_dev.tenant_tbl) 
       THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status
UNION ALL
SELECT 
  'user_security' as table_name,
  (SELECT COUNT(*) FROM sensumaster.user_security) as source_rows,
  (SELECT COUNT(*) FROM sensumaster_dev.user_security) as target_rows,
  CASE WHEN (SELECT COUNT(*) FROM sensumaster.user_security) = (SELECT COUNT(*) FROM sensumaster_dev.user_security) 
       THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status
UNION ALL
SELECT 
  'user_emails' as table_name,
  (SELECT COUNT(*) FROM sensumaster.user_emails) as source_rows,
  (SELECT COUNT(*) FROM sensumaster_dev.user_emails) as target_rows,
  CASE WHEN (SELECT COUNT(*) FROM sensumaster.user_emails) = (SELECT COUNT(*) FROM sensumaster_dev.user_emails) 
       THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status
UNION ALL
SELECT 
  'user_roles' as table_name,
  (SELECT COUNT(*) FROM sensumaster.user_roles) as source_rows,
  (SELECT COUNT(*) FROM sensumaster_dev.user_roles) as target_rows,
  CASE WHEN (SELECT COUNT(*) FROM sensumaster.user_roles) = (SELECT COUNT(*) FROM sensumaster_dev.user_roles) 
       THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status
UNION ALL
SELECT 
  'user_role_assignments' as table_name,
  (SELECT COUNT(*) FROM sensumaster.user_role_assignments) as source_rows,
  (SELECT COUNT(*) FROM sensumaster_dev.user_role_assignments) as target_rows,
  CASE WHEN (SELECT COUNT(*) FROM sensumaster.user_role_assignments) = (SELECT COUNT(*) FROM sensumaster_dev.user_role_assignments) 
       THEN '✅ MATCH' ELSE '❌ MISMATCH' END as status;

-- ==================================================
-- STEP 5: SAMPLE DATA INSPECTION
-- ==================================================

-- Look at sample data from each table to understand structure
SELECT 'TENANT_TBL SAMPLE:' as info;
SELECT * FROM sensumaster_dev.tenant_tbl LIMIT 5;

SELECT 'USER_SECURITY SAMPLE:' as info;
SELECT * FROM sensumaster_dev.user_security LIMIT 5;

SELECT 'USER_EMAILS SAMPLE:' as info;
SELECT * FROM sensumaster_dev.user_emails LIMIT 5;

SELECT 'USER_ROLES SAMPLE:' as info;
SELECT * FROM sensumaster_dev.user_roles LIMIT 5;

SELECT 'USER_ROLE_ASSIGNMENTS SAMPLE:' as info;
SELECT * FROM sensumaster_dev.user_role_assignments LIMIT 5;

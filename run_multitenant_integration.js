#!/usr/bin/env node

const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMultiTenantIntegration() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL_MODE === 'require' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
    } : false
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Set schema
    console.log('📁 Setting schema to sensumaster_dev...');
    await client.query('SET search_path TO sensumaster_dev, public');

    // Check existing tables
    console.log('🔍 Checking existing tenant tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'sensumaster_dev' 
        AND table_name IN ('tenant_tbl', 'user_security', 'user_emails', 'user_roles', 'user_role_assignments')
      ORDER BY table_name
    `);

    console.log('📋 Found tables:', tables.rows.map(r => r.table_name));

    if (tables.rows.length === 0) {
      console.log('❌ No tenant tables found. Please run the table migration first.');
      return;
    }

    // Check tenant data
    console.log('🏢 Checking tenant data...');
    const tenants = await client.query(`
      SELECT tenant_id, tenant_name, parent_tenant_id, is_active 
      FROM tenant_tbl 
      WHERE is_active = true
      ORDER BY tenant_name
      LIMIT 10
    `);

    console.log('🏢 Available tenants:');
    tenants.rows.forEach(tenant => {
      console.log(`  - ${tenant.tenant_id}: ${tenant.tenant_name} ${tenant.parent_tenant_id ? `(parent: ${tenant.parent_tenant_id})` : '(root)'}`);
    });

    // Check user security data
    console.log('👤 Checking user security data...');
    const users = await client.query(`
      SELECT user_id, username, tenant_id, is_active 
      FROM user_security 
      WHERE is_active = true
      ORDER BY username
      LIMIT 10
    `);

    console.log('👤 Available users:');
    users.rows.forEach(user => {
      console.log(`  - ${user.username} (${user.user_id}) in tenant ${user.tenant_id}`);
    });

    // Create claude-flow-ui tables if they don't exist
    console.log('🛠️ Creating Claude-Flow-UI tables with tenant support...');
    
    // Check if users table exists
    const userTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'sensumaster_dev' 
        AND table_name = 'users'
      )
    `);

    if (!userTableExists.rows[0].exists) {
      console.log('📝 Creating users table...');
      await client.query(`
        CREATE TABLE users (
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
          
          CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tbl(tenant_id)
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX idx_users_tenant_id ON users(tenant_id)');
      await client.query('CREATE INDEX idx_users_username ON users(username)');
      await client.query('CREATE INDEX idx_users_email ON users(email)');
      await client.query('CREATE INDEX idx_users_available_tenants ON users USING GIN(available_tenants)');
      
      console.log('✅ Users table created');
    } else {
      console.log('ℹ️ Users table already exists');
    }

    // Create test users with bcrypt + visualizehr_salt
    console.log('👥 Creating test users...');
    
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    
    const hashPasswordWithSalt = async (password) => {
      const saltedPassword = password + 'visualizehr_salt';
      return await bcrypt.hash(saltedPassword, saltRounds);
    };

    // Get available tenants for admin users
    const getAllTenants = async () => {
      const result = await client.query('SELECT tenant_id FROM tenant_tbl WHERE is_active = true');
      return result.rows.map(row => row.tenant_id);
    };

    const allTenants = await getAllTenants();
    
    // Create bennie (root admin) if visualizehr exists
    const hasVisualizehr = allTenants.includes('visualizehr');
    if (hasVisualizehr) {
      const bennieHash = await hashPasswordWithSalt('password');
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          available_tenants = EXCLUDED.available_tenants,
          role = EXCLUDED.role
      `, ['bennie', 'bennie@visualizehr.com', bennieHash, 'admin', 'visualizehr', allTenants, true]);
      console.log('✅ Created/Updated bennie (root admin)');
    }

    // Create jeremy (tenant admin) if coligos exists
    const hasColigos = allTenants.includes('coligos');
    if (hasColigos) {
      const jeremyHash = await hashPasswordWithSalt('password');
      const coligosTenants = allTenants.filter(t => t.startsWith('coligos'));
      await client.query(`
        INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          available_tenants = EXCLUDED.available_tenants,
          role = EXCLUDED.role
      `, ['jeremy', 'jeremy@coligos.com', jeremyHash, 'admin', 'coligos', coligosTenants, true]);
      console.log('✅ Created/Updated jeremy (tenant admin)');
    }

    // Create demo user
    const demoHash = await hashPasswordWithSalt('demo');
    const firstTenant = allTenants[0] || 'demo-tenant';
    await client.query(`
      INSERT INTO users (username, email, password_hash, role, tenant_id, available_tenants, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        available_tenants = EXCLUDED.available_tenants
    `, ['demo', 'demo@example.com', demoHash, 'user', firstTenant, [firstTenant], true]);
    console.log('✅ Created/Updated demo user');

    // Verify created users
    console.log('🔍 Verifying created users...');
    const createdUsers = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.tenant_id,
        array_length(u.available_tenants, 1) as accessible_tenant_count,
        u.available_tenants,
        u.is_active
      FROM users u
      ORDER BY u.role DESC, u.username
    `);

    console.log('👤 Created users:');
    createdUsers.rows.forEach(user => {
      console.log(`  - ${user.username} (${user.role}) - Tenant: ${user.tenant_id}, Access: ${user.accessible_tenant_count} tenants`);
    });

    console.log('🎉 Multi-tenant integration completed successfully!');
    console.log('📝 Next steps:');
    console.log('  1. Update your authentication service to use tenant validation');
    console.log('  2. Test login with: bennie/password, jeremy/password, demo/demo');
    console.log('  3. Verify tenant access controls in your API routes');

  } catch (error) {
    console.error('❌ Error during integration:', error);
    console.error('Full error:', error.stack);
  } finally {
    await client.end();
  }
}

// Run the integration
runMultiTenantIntegration().catch(console.error);

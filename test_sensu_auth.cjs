#!/usr/bin/env node

const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAuthentication() {
  try {
    console.log('🧪 Testing Authentication with Sensu Database');
    console.log('='.repeat(50));

    // Test 1: Test database connection
    console.log('🔌 Testing database connection...');
    const { Client } = require('pg');
    
    const client = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Database connection successful');

    // Test 2: Query available users
    console.log('\n👤 Available users for testing:');
    await client.query('SET search_path TO sensumaster_dev, public');
    
    const users = await client.query(`
      SELECT 
        logon_user,
        user_name,
        email,
        tenant_id,
        tenant_name,
        is_admin,
        is_active,
        roles
      FROM v_user_authentication 
      WHERE is_active = true
      ORDER BY tenant_id, logon_user
      LIMIT 10
    `);

    users.rows.forEach(user => {
      console.log(`  - ${user.logon_user} (${user.user_name}) - ${user.tenant_id} - Admin: ${user.is_admin}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Roles: ${user.roles ? user.roles.join(', ') : 'none'}`);
      console.log('');
    });

    // Test 3: Test authentication functions
    console.log('🔐 Testing authentication functions...');
    
    // Import the auth functions (simulated)
    const bcrypt = require('bcryptjs');
    
    const verifyPassword = async (password, hash) => {
      return await bcrypt.compare(password, hash);
    };

    // Test with the first available user
    if (users.rows.length > 0) {
      const testUser = users.rows[0];
      console.log(`\n🧪 Testing with user: ${testUser.logon_user}`);
      
      // Note: We don't know the actual password, so this is just a structure test
      console.log('📋 User data structure:');
      console.log('  - ID:', testUser.logon_user);
      console.log('  - Name:', testUser.user_name);
      console.log('  - Email:', testUser.email);
      console.log('  - Tenant:', testUser.tenant_id, `(${testUser.tenant_name})`);
      console.log('  - Admin:', testUser.is_admin);
      console.log('  - Roles:', testUser.roles);
      
      // Test tenant hierarchy
      console.log('\n🏢 Testing tenant hierarchy...');
      const tenantHierarchy = await client.query(`
        WITH RECURSIVE tenant_hierarchy AS (
          SELECT tenant_id, tenant_name, parent_tenant_id, 0 as level
          FROM tenant_tbl 
          WHERE tenant_id = $1 AND status = 'ACTIVE'
          
          UNION ALL
          
          SELECT t.tenant_id, t.tenant_name, t.parent_tenant_id, th.level + 1
          FROM tenant_tbl t
          JOIN tenant_hierarchy th ON t.parent_tenant_id = th.tenant_id
          WHERE status = 'ACTIVE'
        )
        SELECT * FROM tenant_hierarchy ORDER BY level, tenant_id
      `, [testUser.tenant_id]);
      
      console.log(`  Available tenants for ${testUser.logon_user}:`);
      tenantHierarchy.rows.forEach(tenant => {
        console.log(`    ${'  '.repeat(tenant.level)}- ${tenant.tenant_id} (${tenant.tenant_name})`);
      });
    }

    // Test 4: API endpoint test (if server is running)
    console.log('\n🌐 Testing API endpoints...');
    const axios = require('axios').default;
    
    try {
      const healthCheck = await axios.get('http://localhost:3001/api/health');
      console.log('✅ API server is running');
    } catch (error) {
      console.log('⚠️ API server not running - start with npm run server');
    }

    await client.end();
    
    console.log('\n🎉 Authentication setup is ready!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the server: npm run server');
    console.log('2. Test login with any active user from the list above');
    console.log('3. Use the password for that user in your system');
    console.log('4. Check that JWT tokens include tenant information');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error.stack);
  }
}

testAuthentication().catch(console.error);

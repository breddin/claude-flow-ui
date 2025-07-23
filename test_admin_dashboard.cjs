#!/usr/bin/env node

const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAdminDashboard() {
  try {
    console.log('🧪 Testing Admin Dashboard API');
    console.log('='.repeat(50));

    // Create a test admin token
    const testToken = jwt.sign(
      {
        username: 'bennie',
        tenant_id: 'visualizehr',
        is_admin: true
      },
      process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-here-min-32-chars',
      { expiresIn: '1h' }
    );

    console.log('🔑 Generated test admin token');

    // Test admin endpoints
    const endpoints = [
      '/api/admin/health',
      '/api/admin/sessions',
      '/api/admin/agents',
      '/api/admin/tasks',
      '/api/admin/communications',
      '/api/admin/stats'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3001${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        
        console.log(`\n📡 ${endpoint}:`);
        console.log(`  Status: ${response.status}`);
        console.log(`  Success: ${data.success}`);
        
        if (data.data && Array.isArray(data.data)) {
          console.log(`  Records: ${data.data.length}`);
        } else if (data.data) {
          console.log(`  Data keys: ${Object.keys(data.data).join(', ')}`);
        }

        if (!response.ok) {
          console.log(`  Error: ${data.error || data.message}`);
        }
      } catch (error) {
        console.log(`\n❌ ${endpoint}: ${error.message}`);
      }
    }

    console.log('\n🎉 Admin dashboard API testing completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Open React app at http://localhost:3000');
    console.log('2. Login with any test user credentials');
    console.log('3. Click "Admin Dashboard" if you have admin privileges');
    console.log('4. View sessions, agents, tasks, and communications');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminDashboard().catch(console.error);

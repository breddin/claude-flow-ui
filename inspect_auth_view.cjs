#!/usr/bin/env node

const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function inspectAuthenticationView() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL_MODE === 'require' ? {
      rejectUnauthorized: false  // Set to false for RDS with self-signed certs
    } : false
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Set schema
    await client.query('SET search_path TO sensumaster_dev, public');

    // Check if the view exists
    console.log('🔍 Checking if v_user_authentication view exists...');
    const viewExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'sensumaster_dev' 
        AND table_name = 'v_user_authentication'
      )
    `);

    if (!viewExists.rows[0].exists) {
      console.log('❌ View v_user_authentication does not exist');
      
      // Check what views are available
      console.log('📋 Available views in sensumaster_dev:');
      const views = await client.query(`
        SELECT table_name, view_definition 
        FROM information_schema.views 
        WHERE table_schema = 'sensumaster_dev'
        ORDER BY table_name
      `);
      
      views.rows.forEach(view => {
        console.log(`  - ${view.table_name}`);
      });
      
      return;
    }

    console.log('✅ View v_user_authentication exists');

    // Get view structure
    console.log('📋 View structure:');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'sensumaster_dev' 
        AND table_name = 'v_user_authentication'
      ORDER BY ordinal_position
    `);

    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
    });

    // Get view definition
    console.log('\n📝 View definition:');
    const definition = await client.query(`
      SELECT view_definition 
      FROM information_schema.views 
      WHERE table_schema = 'sensumaster_dev' 
        AND table_name = 'v_user_authentication'
    `);

    console.log(definition.rows[0].view_definition);

    // Sample data
    console.log('\n📊 Sample data (first 5 rows):');
    const sample = await client.query(`
      SELECT * FROM sensumaster_dev.v_user_authentication 
      LIMIT 5
    `);

    console.log('Sample rows:', sample.rows);

    // Check if common authentication fields exist
    const columns = structure.rows.map(row => row.column_name);
    console.log('\n🔑 Authentication field analysis:');
    console.log(`  - Username field: ${columns.includes('username') ? '✅ username' : columns.includes('user_name') ? '✅ user_name' : '❌ not found'}`);
    console.log(`  - Password field: ${columns.includes('password') ? '✅ password' : columns.includes('password_hash') ? '✅ password_hash' : '❌ not found'}`);
    console.log(`  - Email field: ${columns.includes('email') ? '✅ email' : columns.includes('email_address') ? '✅ email_address' : '❌ not found'}`);
    console.log(`  - Tenant field: ${columns.includes('tenant_id') ? '✅ tenant_id' : '❌ not found'}`);
    console.log(`  - Role field: ${columns.includes('role') ? '✅ role' : columns.includes('role_name') ? '✅ role_name' : '❌ not found'}`);
    console.log(`  - Active field: ${columns.includes('is_active') ? '✅ is_active' : columns.includes('active') ? '✅ active' : '❌ not found'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

inspectAuthenticationView().catch(console.error);

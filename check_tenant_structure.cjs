#!/usr/bin/env node

const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: '.env.local' });

async function checkTenantTable() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query('SET search_path TO sensumaster_dev, public');

    console.log('📋 Tenant table structure:');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'sensumaster_dev' 
        AND table_name = 'tenant_tbl'
      ORDER BY ordinal_position
    `);

    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n📊 Sample tenant data:');
    const tenants = await client.query('SELECT * FROM tenant_tbl LIMIT 5');
    console.log(tenants.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTenantTable();

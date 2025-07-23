#!/usr/bin/env node

import DataSyncService from '../src/services/dataSyncService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Data Synchronization CLI Script
 * Usage: node scripts/sync-data.js [--sessions|--agents|--tasks|--communications|--all]
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--all';

  console.log('🔄 SQLite to PostgreSQL Data Synchronization');
  console.log('============================================');

  const syncService = new DataSyncService();

  try {
    switch (command) {
      case '--sessions':
        await syncService.syncOrchestrationSessions();
        break;
      case '--agents':
        await syncService.syncAgents();
        break;
      case '--tasks':
        await syncService.syncTasks();
        break;
      case '--communications':
        await syncService.syncCommunications();
        break;
      case '--all':
      default:
        await syncService.syncAll();
        break;
    }

    console.log('\n✅ Synchronization completed successfully!');
    console.log('🌐 Admin Dashboard should now show real data');
  } catch (error) {
    console.error('\n❌ Synchronization failed:', error.message);
    process.exit(1);
  } finally {
    await syncService.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received terminate signal, shutting down gracefully...');
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

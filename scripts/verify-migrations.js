#!/usr/bin/env node

/**
 * Script to verify that Prisma migrations are in sync with the database
 * 
 * Usage:
 *   node scripts/verify-migrations.js
 * 
 * Or with a specific DATABASE_URL:
 *   DATABASE_URL="your-db-url" node scripts/verify-migrations.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function getMigrationsFromFilesystem() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
  const migrations = []
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir)
    return migrations
  }
  
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const migrationName = entry.name
      const migrationFile = path.join(migrationsDir, migrationName, 'migration.sql')
      
      if (fs.existsSync(migrationFile)) {
        migrations.push({
          name: migrationName,
          path: migrationFile,
        })
      }
    }
  }
  
  return migrations.sort()
}

async function getMigrationsFromDatabase() {
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY migration_name
    `
    return migrations
  } catch (error) {
    console.error('❌ Error querying database migrations:', error.message)
    if (error.message.includes('_prisma_migrations') || error.message.includes('does not exist')) {
      console.error('   The _prisma_migrations table does not exist. Run migrations first.')
    }
    return []
  }
}

async function verifyMigrations() {
  console.log('🔍 Verifying Prisma migrations...\n')
  
  const fileMigrations = await getMigrationsFromFilesystem()
  const dbMigrations = await getMigrationsFromDatabase()
  
  console.log(`📁 Migrations in filesystem: ${fileMigrations.length}`)
  console.log(`💾 Migrations in database: ${dbMigrations.length}\n`)
  
  const fileMigrationNames = new Set(fileMigrations.map(m => m.name))
  const dbMigrationNames = new Set(dbMigrations.map((m: any) => m.migration_name))
  
  // Find missing migrations
  const missingInDb = fileMigrations.filter(m => !dbMigrationNames.has(m.name))
  const missingInFiles = dbMigrations.filter((m: any) => !fileMigrationNames.has(m.migration_name))
  
  if (missingInDb.length > 0) {
    console.log('⚠️  Migrations in filesystem but NOT in database:')
    missingInDb.forEach(m => {
      console.log(`   - ${m.name}`)
    })
    console.log('\n   To fix, mark these as applied:')
    missingInDb.forEach(m => {
      console.log(`   npx prisma migrate resolve --applied ${m.name}`)
    })
    console.log()
  }
  
  if (missingInFiles.length > 0) {
    console.log('⚠️  Migrations in database but NOT in filesystem:')
    missingInFiles.forEach((m: any) => {
      console.log(`   - ${m.migration_name}`)
    })
    console.log()
  }
  
  if (missingInDb.length === 0 && missingInFiles.length === 0) {
    console.log('✅ All migrations are in sync!')
  } else {
    console.log('❌ Migration sync issues found. See above for details.')
    process.exit(1)
  }
}

async function main() {
  try {
    await verifyMigrations()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


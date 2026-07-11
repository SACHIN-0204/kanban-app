// Runs schema.sql against the configured DATABASE_URL.
// Usage: npm run migrate

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration complete. Tables created (or already existed).');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();

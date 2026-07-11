// Single shared Postgres connection pool, imported wherever we need to query.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Catches errors on idle clients so the whole process doesn't crash
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;

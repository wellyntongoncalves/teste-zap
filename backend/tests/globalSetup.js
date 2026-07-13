const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEST_DB_NAME = 'finance_whatsapp_test';

module.exports = async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres'
  });

  await client.connect();

  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [TEST_DB_NAME]
  );

  if (rowCount === 0) {
    await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  }

  await client.end();
};

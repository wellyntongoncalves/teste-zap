const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Nunca use a connection string de produção aqui: o .env de dev aponta pro
// Supabase, e criar/derrubar o banco de teste lá seria catastrófico. As DB_*
// abaixo são sempre locais. (tests/env.js apaga a DATABASE_URL pelo mesmo motivo.)
const TEST_DB_NAME = 'meubolso_test';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres'
};

module.exports = async () => {
  const client = new Client(config);

  try {
    await client.connect();
  } catch (err) {
    // Sem isso o Jest cospe um "AggregateError" sem dizer o que fazer.
    throw new Error(
      [
        '',
        `Não consegui conectar no Postgres local em ${config.host}:${config.port} (${err.code || err.message}).`,
        '',
        'A suíte precisa de um Postgres local — ela NÃO usa o banco de produção de propósito.',
        'Opções:',
        '  • docker compose up -d postgres',
        '  • instale o Postgres e rode com as credenciais padrão (postgres/postgres)',
        '  • ou aponte DB_HOST/DB_PORT/DB_USER/DB_PASSWORD para um Postgres seu',
        ''
      ].join('\n')
    );
  }

  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await client.end();
  }
};

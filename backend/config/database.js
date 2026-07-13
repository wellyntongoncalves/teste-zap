const { Sequelize } = require('sequelize');
// O Sequelize carrega o driver do Postgres dinamicamente (require em runtime).
// Em ambientes serverless (Vercel), o empacotador faz análise estática e não
// inclui o `pg`/`pg-hstore` no bundle -> erro "Please install pg package manually".
// Importar aqui e passar via `dialectModule` força a inclusão e o uso direto.
const pg = require('pg');
require('pg-hstore');
require('dotenv').config();

// Em produção (Vercel + Supabase/Neon) o banco é acessado por uma única
// "connection string" (DATABASE_URL) e exige SSL. Localmente (Docker/testes)
// continuamos usando as variáveis separadas DB_HOST/DB_NAME/etc. sem SSL.
const useConnectionString = Boolean(process.env.DATABASE_URL);
const useSsl = useConnectionString || process.env.DB_SSL === 'true';

const commonOptions = {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false,
  dialectOptions: useSsl
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  // Pool pequeno: em serverless cada instância abre poucas conexões; use o
  // "pooler" (pgbouncer) do Supabase/Neon como host para evitar esgotar o banco.
  pool: { max: 3, min: 0, idle: 10000, acquire: 30000 }
};

const sequelize = useConnectionString
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      { ...commonOptions, host: process.env.DB_HOST, port: process.env.DB_PORT }
    );

module.exports = sequelize;

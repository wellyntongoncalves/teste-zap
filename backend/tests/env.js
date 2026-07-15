// PRIMEIRA LINHA, e não é opcional: config/database.js prefere DATABASE_URL
// sobre as DB_* quando ela existe. Como o .env de dev aponta pro Supabase de
// produção, deixá-la setada faria a suíte inteira rodar contra os dados reais
// do usuário (criando e apagando registros) — o DB_NAME abaixo seria ignorado.
delete process.env.DATABASE_URL;

process.env.DB_NAME = 'meubolso_test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '30';
process.env.OBSIDIAN_VAULT_PATH = '';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';

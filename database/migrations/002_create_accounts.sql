CREATE TYPE account_type AS ENUM ('corrente', 'poupanca', 'carteira', 'investimento', 'outra');

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type account_type NOT NULL DEFAULT 'carteira',
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (user_id);

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');

CREATE TYPE transaction_category AS ENUM (
  'Alimentação', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Compras',
  'Salário', 'Investimentos', 'Outras Receitas', 'Outros'
);

CREATE TYPE transaction_source AS ENUM ('whatsapp', 'dashboard');

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  destination_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  type transaction_type NOT NULL DEFAULT 'expense',
  amount NUMERIC(10, 2) NOT NULL,
  category transaction_category NOT NULL DEFAULT 'Outros',
  description VARCHAR(255),
  raw_message TEXT,
  source transaction_source NOT NULL DEFAULT 'whatsapp',
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  installment_group_id UUID,
  installment_number INTEGER,
  installment_total INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_occurred ON transactions (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_credit_card ON transactions (credit_card_id);

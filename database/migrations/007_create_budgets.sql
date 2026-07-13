CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category transaction_category,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT TRUE,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK ((category IS NULL) <> (tag_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets (user_id);

-- Usuário de demonstração. Gere o hash com: node -e "console.log(require('bcryptjs').hashSync('demo1234', 10))"
-- e substitua PASSWORD_HASH_PLACEHOLDER abaixo antes de rodar este seed.
INSERT INTO users (name, email, password_hash, whatsapp_number)
VALUES (
  'Usuário Demo',
  'demo@example.com',
  'PASSWORD_HASH_PLACEHOLDER',
  '+5511999990000'
)
ON CONFLICT (email) DO NOTHING;

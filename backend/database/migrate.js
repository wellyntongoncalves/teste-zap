// Migrações de schema — o que o `sequelize.sync()` NÃO faz.
//
// `sync()` (sem `alter: true`) só CRIA tabelas que ainda não existem. Ele nunca
// adiciona uma coluna nova a uma tabela que já está no banco. E `alter: true` em
// produção é perigoso: ele compara e altera tipos, podendo apagar dados.
//
// Por isso as mudanças de coluna moram aqui, como SQL idempotente ("IF NOT
// EXISTS"): rodar dez vezes tem o mesmo efeito de rodar uma. É chamado no cold
// start da função (api/index.js) e no boot local (server.js), logo depois do sync.
const sequelize = require('../config/database');

const STATEMENTS = [
  // Liga um lançamento à conta fixa que o gerou. Nulo = lançamento avulso.
  // Sem FK: apagar a recorrência não pode apagar o histórico já registrado.
  'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_id uuid',
  // Idempotência da geração automática: o mesmo vencimento nunca vira dois
  // lançamentos, mesmo com duas requisições materializando ao mesmo tempo.
  'CREATE UNIQUE INDEX IF NOT EXISTS transactions_recurrence_occurrence ON transactions (recurrence_id, occurred_at) WHERE recurrence_id IS NOT NULL'
];

async function runMigrations() {
  for (const statement of STATEMENTS) {
    await sequelize.query(statement);
  }
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log(`Migrações aplicadas (${STATEMENTS.length}).`);
      return sequelize.close();
    })
    .catch((err) => {
      console.error('Falha ao migrar:', err.message);
      process.exit(1);
    });
}

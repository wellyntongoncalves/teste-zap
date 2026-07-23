/**
 * As suítes que não encostam no banco.
 *
 * `jest.config.js` roda um `globalSetup` que conecta no Postgres e cria o
 * `meubolso_test` — necessário para as suítes de rota, e um bloqueio total para
 * quem só quer conferir o parser do WhatsApp. Sem Postgres na máquina, `npm
 * test` falha antes de executar um único teste, inclusive os seis que nunca
 * precisaram de banco. Na prática isso significa não rodar teste nenhum.
 *
 * Aqui a mesma suíte roda sem `globalSetup`. `tests/env.js` continua sendo
 * carregado: é ele que apaga a `DATABASE_URL` para nada apontar em produção.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.js'],
  maxWorkers: 1,
  testMatch: [
    '<rootDir>/tests/dates.test.js',
    '<rootDir>/tests/money.test.js',
    '<rootDir>/tests/nlp.test.js',
    '<rootDir>/tests/nlpSmart.test.js',
    '<rootDir>/tests/questionRouting.test.js',
    '<rootDir>/tests/recurrenceDates.test.js'
  ]
};

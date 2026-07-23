# CLAUDE.md — MeuBolso

Finanças pessoais: a pessoa manda *"Gastei 50 no mercado"* no WhatsApp e a
transação é categorizada, gravada e vira nota `.md` num vault do Obsidian.
Também tem PWA instalável, cartão de crédito, orçamentos, metas e um assistente
de IA (o **Vero**).

No ar em <https://meubolso-xi.vercel.app> · API <https://meubolso-api.vercel.app>.

> ⚠️ Esta pasta ainda se chama `Documents\Claude` e vai para
> `Projetos- Desenvolvimento\MeuBolso`. O `Mover MeuBolso.bat` está na Área de
> Trabalho — feche o VSCode **e o Claude Code** antes, porque a pasta é onde ele
> roda e o Windows recusa mover.

## Antes de mexer, leia a documentação

Dois cofres do Obsidian, com papéis diferentes:

- **`Projetos- Desenvolvimento\Well`** — o cérebro geral.
  `00 - Central/Dashboard Geral.md`, `00 - Central/Pendências Gerais.md`,
  `01 - Projetos/MeuBolso/01 - Estado Atual.md` e `13 - Testes.md`.
- **`Projetos- Desenvolvimento\MeuBolso-Vault`** — docs técnicos do app, em
  `Financas/`: Arquitetura, Design System, Vero (IA).

**Ao terminar, atualize-os.** O `CLAUDE.md` do cofre `Well` explica o formato.

## Arquitetura

```
/backend    Express + Sequelize (PostgreSQL) — serverless na Vercel
/frontend   React 18 (CRA) + React Router — PWA instalável
/database   migrations SQL de referência (o server usa sequelize.sync())
/vault      cofre do Obsidian embutido no repositório
```

O backend roda na nuvem e não enxerga o PC, então grava as notas do Obsidian
**via API do GitHub** no repositório do cofre; o plugin Obsidian Git puxa.

## Comandos

```bash
cd backend
npm install
npm run test:unit    # 81 testes de lógica pura — não precisa de nada
npm test             # 130 testes — PRECISA de Postgres em localhost:5432
npm run dev

cd frontend && npm install && npm start
docker compose up --build      # tudo de uma vez
```

## Regras que não se afrouxam

- **`tests/env.js` apaga a `DATABASE_URL` na primeira linha.** Não é detalhe:
  `config/database.js` prefere a connection string sobre as `DB_*`, e o `.env` de
  dev aponta para o Supabase de **produção**. Sem esse `delete`, bastaria existir
  um Postgres local para os testes criarem e apagarem registros nos dados reais.
- **`isQuestion()` roda ANTES do `parseAmount`.** *"quanto gastei 2026"* casa com
  o padrão de valor e viraria uma despesa de R$ 2.026.
  `tests/questionRouting.test.js` trava isso. **Não inverta a ordem.**
- **Regex primeiro, LLM só quando ele desiste.** O regex acerta o caso comum
  (inclusive gíria: "80 pila", "50 conto"), é instantâneo e não custa nada.
- **Falha do LLM não bloqueia o usuário** — vale o veredito do regex.
  Indisponibilidade de API não pode impedir alguém de registrar um gasto.
- **Saldo é computado**, nunca armazenado: `initialBalance` + transações. Compra
  no cartão fica de fora, porque pertence à fatura.
- **Cor sozinha nunca carrega significado.** Receita/despesa levam ícone e
  rótulo — verde/vermelho é o par que some no daltonismo. Hex novo só passa pelo
  validador de contraste.

## Ao escolher uma frase de teste para o LLM

Confirme que o regex **de fato** desiste dela. Três testes já ficaram vermelhos
acusando um bug inexistente quando o regex aprendeu gíria e passou a resolver a
frase-gatilho sozinho. Hoje a frase usa valor por extenso ("saiu oitenta").

## Não mexa sem analisar antes

- `backend/tests/env.js` e `globalSetup.js` — são a barreira entre teste e
  produção.
- `backend/services/nlp.js` — a ordem das regex é significativa.
- `backend/models/` — o saldo depende de `computeBalance` somar as transações;
  já houve um stub aqui que devolvia só o saldo inicial.

## Estado do Git

`wellyntongoncalves/teste-zap`, branch `main`, limpa e em dia. O repositório
ainda tem o nome antigo — renomear para `MeuBolso` está pendente.

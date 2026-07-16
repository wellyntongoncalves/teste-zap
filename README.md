# MeuBolso

Gerenciador financeiro pessoal com múltiplas contas, cartão de crédito, orçamentos,
metas e integração com WhatsApp: o usuário envia mensagens ("Gastei 50 reais no
mercado", "Recebi 3000 reais de salário") e a transação é categorizada e registrada
automaticamente. Estrutura inspirada em apps de finanças completos (tipo "Minhas
Finanças: Controle e IA"), adaptada para um PWA web + bot de WhatsApp em vez de um
app nativo iOS/Mac.

## Estrutura

```
/backend      Node.js + Express + Sequelize (PostgreSQL)
/frontend     React + React Router + Chart.js (PWA)
/database     Migrations e seeders SQL
```

## Como rodar

### 1. Subir tudo com Docker

```bash
cp backend/.env.example backend/.env
# edite backend/.env com as credenciais da Twilio
docker-compose up --build
```

- Backend: http://localhost:3000
- Frontend: http://localhost:8080
- Postgres: localhost:5432

### 2. Rodar localmente sem Docker

```bash
# backend
cd backend
cp .env.example .env
npm install
npm run dev

# frontend (em outro terminal)
cd frontend
npm install
npm start
```

O `server.js` chama `sequelize.sync()` na inicialização, criando as tabelas
automaticamente a partir dos models. Os arquivos em `database/migrations` servem
como referência SQL equivalente (úteis se preferir gerenciar o schema fora do Sequelize).

## Integração com WhatsApp (Twilio)

1. Crie uma conta na [Twilio](https://www.twilio.com/whatsapp) e ative o WhatsApp Sandbox (ou um número aprovado para produção).
2. Preencha `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_WHATSAPP_NUMBER` no `.env`.
3. No console da Twilio, configure o webhook "When a message comes in" apontando para:
   ```
   https://SEU_DOMINIO/api/whatsapp/webhook
   ```
   Em desenvolvimento local, use `ngrok http 3000` para expor a URL.
4. Cadastre o número de WhatsApp do usuário no campo `whatsappNumber` ao criar a conta
   (via `POST /api/auth/register` ou diretamente no dashboard).

> A API oficial do WhatsApp Business (Cloud API) também pode substituir a Twilio;
> o único ponto de integração a trocar é `backend/services/whatsapp.js` (envio) e
> `backend/routes/whatsapp.js` (recebimento do payload do webhook).

## Modelo de dados

Tudo gira em torno de `Transaction` (`backend/models/transaction.js`), um livro-razão
unificado com `type` (`income`/`expense`/`transfer`), sempre associado a uma `Account`
(conta/carteira). Cada usuário ganha uma "Conta Padrão" automaticamente no registro.

- **Account** — contas/carteiras (corrente, poupança, investimento...), saldo sempre
  computado a partir de `initialBalance` + transações, nunca armazenado.
- **Transaction** — receita, despesa ou transferência entre contas; suporta
  parcelamento (`installmentGroupId`/`installmentNumber`/`installmentTotal`) e tags.
- **Tag** — etiquetas livres, N:N com transações via `TransactionTag`.
- **Budget** — orçamento mensal por categoria OU por tag (exatamente um dos dois).
- **CreditCard** — cartão com dia de fechamento/vencimento; `GET /credit-cards/:id/invoices`
  agrupa as transações por fatura de acordo com o `closingDay`.
- **Goal** — meta financeira com progresso (`currentAmount`/`targetAmount`),
  atualizada via `POST /goals/:id/contributions`.

## Navegação do frontend

O React usa `react-router-dom` com uma barra de navegação inferior (mobile-first):
**Início** (resumo do mês), **Lançamentos** (lista + exportação), **Cartões**
(cartões de crédito + orçamentos aninhados) e **Metas**. Contas e Tags ficam em
**Configurações**, acessível pelo ícone ⚙️ no cabeçalho. Estrutura de pastas em
`frontend/src/`:

```
components/
  layout/         Layout.js — header + barra de navegação + <Outlet/>
  transactions/   TransactionChart.js, TransactionList.js
  accounts/       Accounts.js
  tags/           Tags.js
  budgets/        Budgets.js
  creditCards/    CreditCards.js
  goals/          Goals.js
  Login.js
pages/            Home, Transactions, Cards, GoalsPage, Settings — compõem os
                  componentes acima em cada rota
```

A sessão (JWT + dados do usuário) é persistida em `localStorage` e restaurada ao
carregar a página (`App.js`), então um refresh ou reabertura do PWA não desloga o
usuário enquanto o refresh token continuar válido.

## Fluxo de uso (WhatsApp)

1. Usuário envia: `"Paguei 120 reais de energia"` ou `"Recebi 3000 reais de salário"`.
2. `services/nlp.js` extrai valor, categoria e tipo (receita/despesa) via regex e
   palavras-chave (`CATEGORY_KEYWORDS`, `INCOME_KEYWORDS`).
3. `routes/whatsapp.js` lança a transação na conta padrão do usuário e responde a
   confirmação pelo próprio WhatsApp.
4. O dashboard (`GET /api/transactions` e `GET /api/transactions/summary`) reflete a
   nova transação na próxima consulta.

## Integração com Obsidian + VSCode

A pasta [`vault/`](vault/README.md) é ao mesmo tempo um vault do Obsidian e uma
pasta comum do repositório. Abra-a no Obsidian (`Arquivo > Abrir pasta como
vault`) e mantenha o repositório aberto no VSCode ao mesmo tempo: como as duas
ferramentas só leem/escrevem os mesmos arquivos `.md` no disco, qualquer
alteração feita em uma aparece na outra assim que o arquivo é salvo — sem
plugin ou serviço externo.

Além disso, defina `OBSIDIAN_VAULT_PATH` no `backend/.env` (aponta por padrão
para `../vault`, mas pode ser qualquer vault já existente no seu PC) para que
cada transação registrada — via WhatsApp ou pelo dashboard — também vire/atualize
uma nota Markdown em `vault/Transacoes/<usuario>/<AAAA-MM>.md`, com tabela e saldo
líquido do mês. Veja `backend/services/obsidian.js`.

## Autenticação e refresh token

O login retorna dois tokens:

- `token` — JWT de acesso, curta duração (`JWT_EXPIRES_IN`, padrão 15 minutos).
- `refreshToken` — string aleatória de longa duração (`REFRESH_TOKEN_EXPIRES_IN_DAYS`,
  padrão 30 dias), armazenada com hash SHA-256 na tabela `refresh_tokens`.

Quando o access token expira, o frontend (`frontend/src/api.js`) intercepta o 401,
chama `POST /api/auth/refresh` automaticamente com o refresh token guardado, e
repete a requisição original. Cada uso de um refresh token o invalida e emite um
novo (rotação) — reutilizar um token já trocado retorna 401. `POST /api/auth/logout`
revoga o refresh token no logout.

## Segurança do webhook Twilio

`backend/routes/whatsapp.js` valida o header `X-Twilio-Signature` usando
`twilio.validateRequest()` antes de processar qualquer mensagem, para garantir que
a requisição realmente veio da Twilio. Sem `TWILIO_AUTH_TOKEN` configurado (ex:
ambiente de desenvolvimento local sem conta Twilio), a validação é pulada.

## Testes automatizados

```bash
cd backend
npm install
npm test
```

Usa Jest + Supertest (53 testes em 9 suítes). `tests/nlp.test.js` cobre a extração
de valor/categoria/tipo sem depender de banco. As demais (`auth`, `accounts`,
`transactions`, `whatsapp`, `tags`, `budgets`, `creditCards`, `goals`) sobem o app
via `supertest` (sem precisar de `app.listen`) contra um banco `meubolso_test`
dedicado — criado automaticamente pelo `tests/globalSetup.js` caso não exista.
Requer um Postgres acessível (local ou via `docker-compose up postgres`).

Rodando dentro do Docker (sem precisar instalar Node no host):

```bash
docker compose run --rm -e DB_HOST=postgres backend sh -c "npm install && npm test"
```

## PWA — instalar no iPhone e Android

O frontend é um Progressive Web App: tem `manifest.json`, ícones e um service
worker (`frontend/public/service-worker.js`) que cacheia o app shell para
funcionar offline e ser instalado como um app.

- **iPhone/iPad (Safari)**: abra o dashboard → botão de compartilhar → "Adicionar
  à Tela de Início".
- **Android (Chrome)**: abra o dashboard → menu → "Instalar app" (ou banner
  automático).

Chamadas para `/api/` nunca são servidas do cache (dados financeiros sempre vêm
da rede); apenas o HTML/JS/CSS/ícones do app shell são cacheados.

> Isso cobre "funciona no iPhone e no Android" sem exigir Xcode/macOS. Não é o
> mesmo que um app nativo na App Store/Play Store — para isso seria necessário
> empacotar com Capacitor/PWABuilder (web) ou reescrever em Swift/SwiftUI +
> Kotlin/Compose (nativo), ambos fora do escopo atual.

## Principais endpoints da API

| Método | Rota                                    | Descrição                                     |
|--------|------------------------------------------|------------------------------------------------|
| POST   | `/api/auth/register`                     | Cria usuário + conta padrão                     |
| POST   | `/api/auth/login`                        | Retorna access token + refresh token            |
| POST   | `/api/auth/refresh`                      | Troca um refresh token válido por um novo par   |
| POST   | `/api/auth/logout`                       | Revoga um refresh token                         |
| POST   | `/api/whatsapp/webhook`                  | Recebido pela Twilio a cada mensagem            |
| GET    | `/api/accounts`                          | Lista contas (com saldo computado)              |
| POST   | `/api/accounts`                          | Cria conta                                      |
| GET    | `/api/transactions?month=&year=&type=`   | Lista transações do usuário autenticado         |
| POST   | `/api/transactions`                      | Cria transação (aceita `tags[]`, `installments`)|
| PATCH  | `/api/transactions/:id`                  | Corrige uma transação                           |
| DELETE | `/api/transactions/:id?scope=group`      | Apaga (com `scope=group`, a compra parcelada inteira) |
| GET    | `/api/transactions/summary`              | Totais de receita/despesa/saldo no período      |
| GET    | `/api/transactions/export/csv\|pdf`      | Exporta transações do período                   |
| GET    | `/api/tags`                              | Lista/cria tags                                 |
| GET    | `/api/budgets/status`                    | Orçado vs. realizado do mês                     |
| GET    | `/api/credit-cards/:id/invoices`         | Transações do cartão agrupadas por fatura       |
| POST   | `/api/goals/:id/contributions`           | Adiciona valor a uma meta                       |
| POST   | `/api/assistant`                         | Pergunta ao Vero sobre as próprias finanças     |
| GET    | `/api/assistant/status`                  | Diz se o Vero está configurado                  |
| GET    | `/api/insights`                          | Cobranças recorrentes + projeção do mês         |

## Vero — o assistente financeiro

`POST /api/assistant` responde perguntas em linguagem natural sobre as finanças
do próprio usuário ("quanto gastei com mercado esse mês?", "onde estou
estourando o orçamento?").

Como funciona: `services/assistant.js` monta um **retrato compacto** das finanças
(totais do mês e do anterior, despesas por categoria, contas com saldo,
orçamentos, metas e as últimas 20 transações) e manda numa **única** chamada ao
Claude junto da pergunta. Não há loop de ferramentas — os dados já estão todos
aqui, então buscá-los via tool seria complexidade sem ganho.

Configure a `ANTHROPIC_API_KEY` no `.env` para ligar. **Sem a chave o Vero fica
desligado** e responde `503` — o resto da API segue funcionando. `GET
/api/assistant/status` diz se está ligado, para a UI esconder o chat em vez de
oferecer algo quebrado.

O modelo é `claude-opus-4-8` com *thinking* adaptativo. Vale saber ao mexer:
`budget_tokens`, `temperature`, `top_p` e `top_k` **foram removidos** nesse
modelo e retornam 400 — a profundidade de raciocínio se controla por
`thinking: {type:'adaptive'}` + `output_config: {effort}`.

Os testes (`tests/assistant.test.js`) mockam o SDK, então rodam sem chave e sem
rede.

## Padrões e projeção

`GET /api/insights` acha sozinho as cobranças que se repetem e projeta como o
mês fecha. É lógica pura — não depende de chave nem de integração bancária.

A detecção (`services/insights.js`) agrupa por descrição normalizada, então
"Netflix 12/2025", "NETFLIX" e "Netflix" são a mesma assinatura — sem isso a
projeção contaria a mesma cobrança três vezes. Exige três meses distintos (dois
seria ruído: duas idas ao mercado viram "assinatura") e tolera 25% de variação,
senão perderia justamente as contas variáveis, que são as que interessa
projetar. Usa mediana e não média, para um mês atípico não definir o padrão.

A projeção parte do saldo real das contas e só soma recorrentes que ainda não
caíram — se a assinatura já foi debitada, ela já está no saldo.

## Perguntas pelo WhatsApp

O webhook roteia: mensagem com valor vira lançamento; **pergunta vai pro Vero**
e volta respondida no próprio WhatsApp.

`isQuestion()` (em `services/nlp.js`) roda **antes** do `parseAmount`, e a ordem
é o ponto: "quanto gastei 2026" casa com o padrão de valor (o verbo colado ao
número) e viraria uma despesa de R$ 2.026. `tests/questionRouting.test.js` trava
esse caso — não inverta a ordem.

A Twilio reenvia o webhook se a resposta demorar, então respondemos `200` na
hora e mandamos a resposta do Vero quando fica pronta.

## Como uma mensagem vira lançamento

`services/nlpSmart.js` tenta o regex primeiro e só chama o LLM quando ele
desiste. O regex acerta o caso comum ("Gastei 50 reais no mercado"), é
instantâneo e não custa nada — não faz sentido pagar uma chamada por ele. O LLM
entra para o que palavra-chave não pega ("almocei com a galera, saiu 80 pila")
e usa `claude-haiku-4-5` com saída estruturada, porque parsear texto livre e
torcer seria pior.

Se o LLM falhar ou não houver chave, vale o veredito do regex: uma indisponi-
bilidade da API não pode impedir alguém de registrar um gasto.

## Próximos passos sugeridos

- Resumo diário pelo WhatsApp (depende do Twilio configurado).
- Áudio no WhatsApp (depende de uma API de transcrição).

Fora de alcance: **Open Finance** (puxar do banco automaticamente) exige
autorização do Banco Central e parceria com instituição financeira.
- Reconhecimento de recibo por foto (OCR/visão) — mesma dependência de API paga.
- Multi-moeda de verdade (conversão automática entre contas em moedas diferentes).
- Empacotar o PWA com Capacitor/PWABuilder para publicar nas lojas, ou iniciar
  um app nativo Swift/SwiftUI (exige macOS/Xcode, não disponível neste ambiente).

---
tags: arquitetura
---

# Arquitetura — MeuBolso

## Fluxo

```
WhatsApp (Twilio) --webhook--> backend/routes/whatsapp.js
                                     |
                                     v
                          backend/services/nlp.js (extrai valor + categoria)
                                     |
                                     v
                          Postgres (tabela expenses)
                                     |
                        +------------+------------+
                        v                          v
              backend/services/obsidian.js   frontend (dashboard React)
                        |
                        v
              vault/Gastos/<usuario>/<mes>.md
```

## Componentes

- **backend/** — Express + Sequelize. Ver [[../README|README do projeto]].
- **frontend/** — React + Chart.js, consome a API REST autenticada por JWT.
- **vault/** — este vault, espelhando os gastos como notas Markdown.

## Decisões

- NLP simples por regex/palavras-chave (`backend/services/nlp.js`) — suficiente
  para o escopo inicial; trocar por lib dedicada ou LLM se as frases variarem
  muito.
- Sincronização com Obsidian é *file-based*: o backend escreve diretamente no
  disco do vault, sem depender de plugins como o Local REST API.

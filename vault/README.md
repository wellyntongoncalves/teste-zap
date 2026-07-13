---
tags: index
---

# Vault do Projeto Finanças WhatsApp

Esta pasta é ao mesmo tempo:

- Um **vault do Obsidian** (abra-a via `Arquivo > Abrir pasta como vault`).
- Uma pasta comum dentro do repositório, editável no **VSCode**.

Como as duas ferramentas apenas leem/escrevem arquivos `.md` no disco, qualquer
edição feita em uma aparece automaticamente na outra assim que o arquivo é salvo
— não há serviço externo nem plugin necessário para isso.

## Estrutura

- [[Arquitetura]] — decisões técnicas e visão geral do sistema.
- `Gastos/<usuario>/<AAAA-MM>.md` — geradas automaticamente pelo backend
  (`backend/services/obsidian.js`) sempre que um gasto é registrado via WhatsApp
  ou pelo dashboard. Não edite os totais manualmente; eles são recalculados
  a cada novo gasto.

## Ativar a sincronização automática de gastos

No `backend/.env`, defina:

```
OBSIDIAN_VAULT_PATH=../vault
```

(ajuste o caminho se o vault estiver em outro lugar, incluindo fora deste
repositório — pode apontar para qualquer vault Obsidian já existente no seu PC).
Reinicie o backend após alterar o `.env`.

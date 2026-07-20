# Paleta do MeuBolso — o que o validador decidiu

A referência é `brandbook.png` (feita pelo dono). Este arquivo registra o que
sobreviveu à validação, porque **brandbook não é paleta de produto**: um
brandbook escolhe cores bonitas juntas, um produto precisa que cada cor cumpra
um papel com contraste suficiente para ser lida.

Regra do projeto: **nenhum hex entra no `theme.css` sem passar pelo validador**
(script do skill `dataviz`). Vale para cor de dado e para cor de texto.

## O que reprovou (e por quê)

| Tentativa | Resultado | Consequência |
|---|---|---|
| Paleta do brandbook como paleta **categórica** de gráfico (dark) | FALHOU — lightness fora da banda (verde 0.76, lima 0.90, âmbar 0.82; banda dark é 0.48–0.67) e o cinza `#94A69D` reprovou no piso de croma (0.024, "lê acinzentado") | Não nos afeta: **o gráfico do app é de série única** (barra ranqueada). Se um dia entrar gráfico multi-série, essa paleta NÃO serve como está. |
| Matizes do brandbook rebaixados para dentro da banda | FALHOU — verde/lima/âmbar/laranja são todos do mesmo arco quente; pior par adjacente ΔE 3.8 (deutan) e 13.1 (visão normal, piso é 15) | Confirma o item acima: a marca tem hues demais vizinhos para virar série categórica. |
| `#35D07F` (verde da marca) como **texto** em superfície clara | FALHOU — 2.00:1 | No tema claro a marca escurece: `#0E7350` no texto. |
| `#35D07F` como **preenchimento** em superfície clara | FALHOU — 2.00:1 (mínimo 3) | No tema claro o preenchimento é `#19A165` (3.32). |
| Texto **branco** dentro do botão verde | FALHOU — 1.85:1 | `--on-brand` é **escuro** (`#07110D`) nos dois temas. |
| Âmbar `#F5B942` como texto/preenchimento no claro | FALHOU — 1.76 / 2.30 | No claro o aviso vira `#8A5A00` (5.93). |
| Azul `#5B8CFF` como texto no claro | FALHOU — 3.16 | No claro vira `#2F5FD0` (5.72). |

## O que passou (o que está no `theme.css`)

### Escuro — o visual da marca, e o padrão do app

| Papel | Hex | Contraste na superfície `#0B1A14` |
|---|---|---|
| `--ink` texto principal | `#F3F7F4` | 16.57 |
| `--ink-2` secundário | `#C6D6CE` | 11.87 |
| `--muted` apoio | `#94A69D` | 7.00 |
| `--brand` preenchimento | `#35D07F` | 8.94 |
| `--brand-ink` texto de marca | `#76F0A7` | 12.62 |
| `--critical` | `#FF662B` | 6.13 |
| `--warn` | `#F5B942` | 10.15 |
| `--info` | `#5B8CFF` | 5.67 |
| `--on-brand` (dentro do botão) | `#07110D` | 9.57 sobre o verde |

### Claro — continua existindo, com hexes próprios

| Papel | Hex | Contraste em `#FFFFFF` |
|---|---|---|
| `--ink` | `#07110D` | 19.18 |
| `--ink-2` | `#3C4A44` | 9.31 |
| `--muted` | `#5F706A` | 5.23 |
| `--brand` preenchimento | `#19A165` | 3.32 |
| `--brand-ink` texto | `#0E7350` | 5.85 |
| `--critical` / `--critical-ink` | `#C4441A` / `#B33C14` | 5.01 / 5.88 |
| `--warn` | `#8A5A00` | 5.93 |
| `--info` / `--info-ink` | `#4A78E8` / `#2F5FD0` | 4.08 (preenche) / 5.72 (texto) |
| `--on-brand` | `#07110D` | 5.78 sobre o verde claro |

## Tipografia

- **Manrope** — títulos (`.h1`, `.h2`) e números grandes (`.hero-value`, `.kpi-value`).
- **Inter** — interface, corpo, rótulos.
- **JetBrains Mono** — valores em lista e em coluna (`.row-value`, `td.num`):
  dígitos de largura igual alinham sozinhos.

Carregadas por `<link>` no `public/index.html` com `display=swap`, e cada uma
tem fallback de sistema — se a fonte não baixar, o app continua legível.

## Como revalidar

```bash
node <skill dataviz>/scripts/validate_palette.js "<hex,hex,…>" --mode dark --surface "#0B1A14"
```

Para cor de **texto** o que vale é contraste WCAG por papel (≥ 4.5:1), não o
validador categórico — foi assim que as decisões acima foram tomadas.

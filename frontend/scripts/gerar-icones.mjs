/**
 * Gera os ícones do PWA a partir do escudo da marca (brandbook em
 * `docs/brand/brandbook.png`).
 *
 * ⚠️ O desenho aqui é o MESMO de `src/components/BrandMark.js`. São dois lugares
 * porque um é React e o outro é imagem — se a marca mudar, mude nos dois, senão
 * o ícone da tela inicial fica diferente do ícone dentro do app.
 *
 * Como rodar (o sharp não é dependência do app, só desta geração):
 *
 *     npx --yes sharp@0.33 --help    # confirma que baixa
 *     node scripts/gerar-icones.mjs public
 *
 * Se o `import sharp` falhar, rode de dentro de um projeto que já tenha sharp
 * instalado (qualquer app Next serve) apontando o destino para esta pasta.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const FUNDO = "#07110d"; // theme_color do manifest
const VERDE = "#35d07f"; // --brand do theme.css

function svg(tamanho, traco, raio) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="${raio}" fill="${FUNDO}"/>
  <g fill="none" stroke="${VERDE}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 4 5.2 6.6v5.1c0 3.9 2.7 7 6.8 8.2 4.1-1.2 6.8-4.3 6.8-8.2V6.6L12 4Z"/>
    <path d="M9 14.7V9.9l3 2.9 3-2.9v4.8"/>
  </g>
</svg>`;
}

// O traço engrossa nos tamanhos pequenos: o 1.9 original (num viewBox de 24)
// vira menos de 2px reais a 192 e o escudo some.
const alvos = [
  { arquivo: "icon-512.png", tamanho: 512, traco: 1.5, raio: 5 },
  { arquivo: "icon-192.png", tamanho: 192, traco: 1.7, raio: 5 },
  // iOS recorta o canto sozinho — aqui vai reto, senão fica borda dupla.
  { arquivo: "apple-touch-icon.png", tamanho: 180, traco: 1.7, raio: 0 },
];

const destino = process.argv[2];
if (!destino) {
  console.error("Uso: node scripts/gerar-icones.mjs <pasta-destino>   (ex.: public)");
  process.exit(1);
}

for (const alvo of alvos) {
  const png = await sharp(Buffer.from(svg(alvo.tamanho, alvo.traco, alvo.raio)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(`${destino}/${alvo.arquivo}`, png);
  console.log(`${alvo.arquivo} — ${alvo.tamanho}px, ${png.length} bytes`);
}

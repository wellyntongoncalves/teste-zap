/**
 * Gera os ícones do MeuBolso a partir do símbolo que já existe dentro do app.
 *
 *     node scripts/gerar-icones.mjs
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * O ícone do PWA e o `BrandMark.js` eram dois desenhos diferentes do mesmo
 * escudo: o de dentro do app é traço fino e geometria limpa; o do PWA tinha sido
 * redesenhado à mão, mais pesado e com a base arredondada. Duas verdades para a
 * mesma marca é uma a mais.
 *
 * Agora existe uma só: **a geometria abaixo é copiada do `BrandMark.js`**, e os
 * PNGs saem dela. Mudou a marca? Mude ali, ajuste aqui, rode o script.
 *
 * COMO ELE DESENHA SEM NENHUMA BIBLIOTECA
 *
 * Não há `sharp`, `canvas`, `resvg` nem navegador nesta máquina — e instalar um
 * rasterizador de 40 MB para desenhar dois traços seria desproporcional. Então o
 * desenho é feito no braço, e o caminho é mais simples do que parece:
 *
 *   1. As curvas do escudo viram uma sequência de pontos (achatamento de Bézier);
 *   2. Para cada ponto da imagem, calcula-se a **menor distância até a linha**;
 *   3. Pinta-se onde essa distância é menor que a metade da espessura.
 *
 * O passo 3 é literalmente a definição de um traço com ponta redonda — por isso
 * as junções e as pontas saem certas de graça, sem código de canto. O
 * serrilhado some com supersampling: cada pixel é medido 16 vezes e a média vira
 * a transparência.
 *
 * O PNG é escrito à mão também (IHDR/IDAT/IEND + CRC32), com o `zlib` do
 * próprio Node comprimindo as linhas.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// -----------------------------------------------------------------------------
// A marca — copiada de frontend/src/components/BrandMark.js (viewBox 0 0 24 24)
// -----------------------------------------------------------------------------

/** Escudo: dois lados retos, duas curvas embaixo, ponta em cima. */
const ESCUDO = [
  { tipo: "linha", de: [12, 2.5], para: [4, 5.6] },
  { tipo: "linha", de: [4, 5.6], para: [4, 11.7] },
  { tipo: "curva", de: [4, 11.7], c1: [4, 16.4], c2: [7.2, 20.1], para: [12, 21.5] },
  { tipo: "curva", de: [12, 21.5], c1: [16.8, 20.1], c2: [20, 16.4], para: [20, 11.7] },
  { tipo: "linha", de: [20, 11.7], para: [20, 5.6] },
  { tipo: "linha", de: [20, 5.6], para: [12, 2.5] },
];

/** O "M" dentro do escudo: um traço só, quatro pontos. */
const LETRA = [
  [8.4, 15.6],
  [8.4, 9.6],
  [12, 13.1],
  [15.6, 9.6],
  [15.6, 15.6],
];

const ESPESSURA = 1.9; // igual ao strokeWidth do BrandMark

// Cores do tema escuro do app (frontend/src/**.css).
//
// O fundo é **chapado**, e essa foi uma decisão tomada olhando o resultado: a
// primeira versão tinha um degradê sutil de `#0b1a13` para `#07110d`, e ele
// aparecia como uma faixa horizontal nítida no meio do ícone. Entre duas cores
// tão próximas cabem poucos passos de 8 bits, e o degradê vira degrau. Num
// símbolo minimalista, isso é sujeira — não profundidade.
const FUNDO = [0x07, 0x11, 0x0d]; // = theme_color do manifest
const MARCA = [0x35, 0xd0, 0x7f]; // --brand

// -----------------------------------------------------------------------------
// Geometria
// -----------------------------------------------------------------------------

/** Achata uma cúbica em segmentos. 24 passos é liso o bastante em 512px. */
function achatar(de, c1, c2, para, passos = 24) {
  const pontos = [];
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    const u = 1 - t;
    pontos.push([
      u * u * u * de[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * para[0],
      u * u * u * de[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * para[1],
    ]);
  }
  return pontos;
}

/** Todos os segmentos da marca, em coordenadas do viewBox. */
function segmentos() {
  const saida = [];
  const ligar = (pontos) => {
    for (let i = 0; i + 1 < pontos.length; i++) saida.push([pontos[i], pontos[i + 1]]);
  };

  for (const parte of ESCUDO) {
    if (parte.tipo === "linha") saida.push([parte.de, parte.para]);
    else ligar(achatar(parte.de, parte.c1, parte.c2, parte.para));
  }
  ligar(LETRA);
  return saida;
}

/** Distância de um ponto ao segmento — o coração do traço de ponta redonda. */
function distancia(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax;
  const dy = by - ay;
  const comprimento = dx * dx + dy * dy;
  let t = comprimento === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / comprimento;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

// -----------------------------------------------------------------------------
// Desenho
// -----------------------------------------------------------------------------

/**
 * @param lado      tamanho em pixels
 * @param proporcao quanto da imagem a marca ocupa (0..1)
 * @param raio      arredondamento do fundo, em fração do lado (0 = quadrado)
 */
function desenhar(lado, proporcao, raio) {
  const segs = segmentos();
  const escala = (lado * proporcao) / 24;
  const deslocamento = (lado - 24 * escala) / 2;
  const meiaEspessura = (ESPESSURA * escala) / 2;
  const raioPx = raio * lado;

  const AMOSTRAS = 4; // 4x4 por pixel
  const pixels = Buffer.alloc(lado * lado * 4);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let dentroDoFundo = 0;
      let dentroDaMarca = 0;

      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const px = x + (sx + 0.5) / AMOSTRAS;
          const py = y + (sy + 0.5) / AMOSTRAS;

          if (dentroDoQuadradoRedondo(px, py, lado, raioPx)) dentroDoFundo++;

          // Coordenada do ponto no espaço do viewBox.
          const vx = (px - deslocamento) / escala;
          const vy = (py - deslocamento) / escala;
          if (vx < -2 || vx > 26 || vy < -2 || vy > 26) continue;

          for (const seg of segs) {
            if (distancia(vx, vy, seg) * escala <= meiaEspessura) {
              dentroDaMarca++;
              break;
            }
          }
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      const alfaFundo = dentroDoFundo / total;
      const alfaMarca = (dentroDaMarca / total) * alfaFundo; // a marca não vaza a placa

      const i = (y * lado + x) * 4;
      pixels[i] = Math.round(FUNDO[0] * (1 - alfaMarca) + MARCA[0] * alfaMarca);
      pixels[i + 1] = Math.round(FUNDO[1] * (1 - alfaMarca) + MARCA[1] * alfaMarca);
      pixels[i + 2] = Math.round(FUNDO[2] * (1 - alfaMarca) + MARCA[2] * alfaMarca);
      pixels[i + 3] = Math.round(alfaFundo * 255);
    }
  }

  return pixels;
}

/** Quadrado de cantos redondos. Raio zero = quadrado inteiro (maskable). */
function dentroDoQuadradoRedondo(x, y, lado, raio) {
  if (raio <= 0) return true;
  const dx = Math.max(raio - x, x - (lado - raio), 0);
  const dy = Math.max(raio - y, y - (lado - raio), 0);
  return dx * dx + dy * dy <= raio * raio;
}

// -----------------------------------------------------------------------------
// PNG na unha
// -----------------------------------------------------------------------------

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pedaco(tipo, dados) {
  const nome = Buffer.from(tipo, "ascii");
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])));
  return Buffer.concat([tamanho, nome, dados, crc]);
}

function png(pixels, lado) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // 10..12 = compressão, filtro e entrelaçamento, todos no padrão (0).

  // Cada linha leva um byte de filtro na frente. Filtro 0 = sem filtro: o
  // desenho é liso e a compressão já resolve; filtro adaptativo aqui seria
  // otimização sem ganho perceptível.
  const bruto = Buffer.alloc(lado * (lado * 4 + 1));
  for (let y = 0; y < lado; y++) {
    bruto[y * (lado * 4 + 1)] = 0;
    pixels.copy(bruto, y * (lado * 4 + 1) + 1, y * lado * 4, (y + 1) * lado * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco("IHDR", ihdr),
    pedaco("IDAT", zlib.deflateSync(bruto, { level: 9 })),
    pedaco("IEND", Buffer.alloc(0)),
  ]);
}

// -----------------------------------------------------------------------------
// SVG — o mesmo desenho, para quem aceita vetor
// -----------------------------------------------------------------------------

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <!-- Gerado por scripts/gerar-icones.mjs a partir de BrandMark.js. -->
  <rect width="24" height="24" rx="5.3" fill="#07110d"/>
  <g fill="none" stroke="#35d07f" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
     transform="translate(12 12) scale(0.72) translate(-12 -12)">
    <path d="M12 2.5 4 5.6v6.1c0 4.7 3.2 8.4 8 9.8 4.8-1.4 8-5.1 8-9.8V5.6L12 2.5Z"/>
    <path d="M8.4 15.6V9.6l3.6 3.5 3.6-3.5v6"/>
  </g>
</svg>
`;

// -----------------------------------------------------------------------------

const destino = path.join(process.cwd(), "frontend", "public");
if (!fs.existsSync(destino)) {
  console.error(`Não achei ${destino}. Rode da raiz do MeuBolso.`);
  process.exit(1);
}

const arquivos = [
  // `any`: cantos redondos, marca folgada.
  { nome: "icon-192.png", lado: 192, proporcao: 0.62, raio: 0.22 },
  { nome: "icon-512.png", lado: 512, proporcao: 0.62, raio: 0.22 },
  // Apple recorta sozinho: entregar já quadrado evita canto duplo.
  { nome: "apple-touch-icon.png", lado: 180, proporcao: 0.62, raio: 0 },
  // `maskable`: o Android corta até 20% de cada lado. A marca encolhe para
  // caber na zona segura — sem isso, o escudo perde a ponta em telefone redondo.
  { nome: "icon-maskable-512.png", lado: 512, proporcao: 0.46, raio: 0 },
];

for (const { nome, lado, proporcao, raio } of arquivos) {
  const inicio = Date.now();
  const dados = png(desenhar(lado, proporcao, raio), lado);
  fs.writeFileSync(path.join(destino, nome), dados);
  console.log(`  ${nome.padEnd(26)} ${lado}px  ${(dados.length / 1024).toFixed(1)} KB  ${Date.now() - inicio}ms`);
}

fs.writeFileSync(path.join(destino, "icon.svg"), SVG, "utf8");
console.log(`  ${"icon.svg".padEnd(26)} vetor`);
console.log("\nPronto. O ícone agora é o mesmo símbolo do BrandMark.");

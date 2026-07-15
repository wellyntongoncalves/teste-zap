const fs = require('fs/promises');
const path = require('path');

// --- Como as notas do Obsidian são gravadas ---
//
// Local (backend rodando no seu PC): grava direto na pasta do vault
// (OBSIDIAN_VAULT_PATH), como antes.
//
// Nuvem (backend serverless no Vercel): o servidor não enxerga a pasta do seu
// PC, então grava as notas num repositório Git via API do GitHub (VAULT_REPO +
// GITHUB_TOKEN). O seu Obsidian local sincroniza esse repositório com o plugin
// "Obsidian Git" — assim a nota lançada pelo WhatsApp aparece no seu "cérebro".
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const VAULT_REPO = process.env.VAULT_REPO; // ex: "wellyntongoncalves/financas-vault"
const VAULT_BRANCH = process.env.VAULT_BRANCH || 'main';

const TYPE_LABELS = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildEmptyNote(userEmail, monthKey) {
  return [
    '---',
    'tags: transacoes',
    `mes: ${monthKey}`,
    `usuario: ${userEmail}`,
    '---',
    '',
    `# Transações de ${monthKey}`,
    '',
    '| Data | Tipo | Valor | Categoria | Descrição |',
    '|------|------|-------|-----------|-----------|',
    '',
    '**Saldo líquido do mês:** R$ 0.00',
    ''
  ].join('\n');
}

function insertRow(content, transaction) {
  const dateStr = new Date(transaction.occurredAt).toISOString().slice(0, 10);
  const typeLabel = TYPE_LABELS[transaction.type] || transaction.type;
  const row = `| ${dateStr} | ${typeLabel} | R$ ${parseFloat(transaction.amount).toFixed(2)} | ${transaction.category} | ${transaction.description || ''} |`;

  const lines = content.split('\n');
  const separatorIndex = lines.findIndex((line) => line.startsWith('|------'));
  lines.splice(separatorIndex + 1, 0, row);

  const net = lines
    .filter((line) => line.startsWith('|') && !line.startsWith('|------') && !line.startsWith('| Data'))
    .reduce((sum, line) => {
      const match = line.match(/\|\s*(Receita|Despesa|Transferência)\s*\|\s*R\$\s*([\d.]+)/);
      if (!match) return sum;
      const amount = parseFloat(match[2]);
      return match[1] === 'Despesa' ? sum - amount : sum + amount;
    }, 0);

  const totalLineIndex = lines.findIndex((line) => line.startsWith('**Saldo líquido do mês:**'));
  lines[totalLineIndex] = `**Saldo líquido do mês:** R$ ${net.toFixed(2)}`;

  return lines.join('\n');
}

// --- Camada de armazenamento no sistema de arquivos (uso local) ---

const fsBackend = {
  async update(relPath, transform) {
    const filePath = path.join(VAULT_PATH, relPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let existing = null;
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      existing = null;
    }
    await fs.writeFile(filePath, transform(existing), 'utf-8');
  }
};

// --- Camada de armazenamento via API do GitHub (uso na nuvem) ---

async function githubApi(method, apiPath, body) {
  // Timeout de segurança: em serverless um fetch pendurado travaria a resposta.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`https://api.github.com/repos/${VAULT_REPO}/${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'meubolso'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function githubRead(relPath) {
  const res = await githubApi('GET', `contents/${relPath}?ref=${VAULT_BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function githubWrite(relPath, content, sha, message) {
  const res = await githubApi('PUT', `contents/${relPath}`, {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: VAULT_BRANCH,
    ...(sha ? { sha } : {})
  });
  if (res.status === 409) return false; // sha desatualizado (escrita concorrente) -> tentar de novo
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
  return true;
}

const githubBackend = {
  async update(relPath, transform) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await githubRead(relPath);
      const next = transform(current ? current.content : null);
      const ok = await githubWrite(relPath, next, current ? current.sha : undefined, `chore: atualiza ${relPath}`);
      if (ok) return;
    }
    throw new Error('conflito de escrita no GitHub após várias tentativas');
  }
};

function pickBackend() {
  if (VAULT_REPO && GITHUB_TOKEN) return githubBackend; // nuvem
  if (VAULT_PATH) return fsBackend; // local
  return null; // desativado
}

async function appendTransactionNote(user, transaction) {
  const backend = pickBackend();
  if (!backend) return;

  const date = new Date(transaction.occurredAt);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const relPath = `Transacoes/${slug(user.email)}/${monthKey}.md`;

  try {
    await backend.update(relPath, (existing) =>
      insertRow(existing || buildEmptyNote(user.email, monthKey), transaction)
    );
  } catch (err) {
    console.warn('Falha ao gravar nota no Obsidian:', err.message);
  }
}

module.exports = { appendTransactionNote };

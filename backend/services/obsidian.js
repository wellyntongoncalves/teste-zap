const fs = require('fs/promises');
const path = require('path');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;

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

async function appendTransactionNote(user, transaction) {
  if (!VAULT_PATH) return;

  const date = new Date(transaction.occurredAt);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const userFolder = path.join(VAULT_PATH, 'Transacoes', slug(user.email));

  try {
    await fs.mkdir(userFolder, { recursive: true });
    const filePath = path.join(userFolder, `${monthKey}.md`);

    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      content = buildEmptyNote(user.email, monthKey);
    }

    content = insertRow(content, transaction);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (err) {
    console.warn('Falha ao gravar nota no Obsidian:', err.message);
  }
}

module.exports = { appendTransactionNote };

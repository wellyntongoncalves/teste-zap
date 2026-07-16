import React, { useState } from 'react';
import api from '../../api';
import { formatMoney, formatDate } from '../../format';

const TYPES = {
  income: { label: 'Receita', className: 'pill pill-income', mark: '↑' },
  expense: { label: 'Despesa', className: 'pill pill-expense', mark: '↓' },
  transfer: { label: 'Transferência', className: 'pill pill-transfer', mark: '↔' }
};

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Compras',
  'Salário', 'Investimentos', 'Outras Receitas', 'Outros'
];

export default function TransactionList({ transactions, privateMode, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const editable = typeof onChanged === 'function';

  if (!transactions || transactions.length === 0) {
    return (
      <div className="empty">
        <div className="empty-mark">🧾</div>
        Nenhuma transação neste mês.
      </div>
    );
  }

  function startEdit(t) {
    setEditing(t.id);
    setDraft({
      amount: String(t.amount),
      category: t.category,
      description: t.description || '',
      occurredAt: new Date(t.occurredAt).toISOString().slice(0, 10)
    });
  }

  async function save(t) {
    setBusy(true);
    try {
      await api.patch(`/transactions/${t.id}`, {
        amount: parseFloat(draft.amount),
        category: draft.category,
        description: draft.description,
        occurredAt: draft.occurredAt
      });
      setEditing(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    const isInstallment = Boolean(t.installmentGroupId);
    const message = isInstallment
      ? `Esta é a parcela ${t.installmentNumber}/${t.installmentTotal}. Apagar a compra inteira (todas as parcelas)?\n\nOK = apaga tudo · Cancelar = apaga só esta parcela`
      : 'Apagar este lançamento?';

    // Numa compra parcelada, apagar só uma parcela deixa o total sem sentido —
    // então perguntamos qual das duas coisas o usuário quer.
    let scope = '';
    if (isInstallment) {
      scope = window.confirm(message) ? '?scope=group' : '';
      if (scope === '' && !window.confirm('Apagar somente esta parcela?')) return;
    } else if (!window.confirm(message)) {
      return;
    }

    setBusy(true);
    try {
      await api.delete(`/transactions/${t.id}${scope}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Descrição</th>
            <th className="num">Valor</th>
            {editable && <th aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const type = TYPES[transaction.type] || TYPES.transfer;
            const amount = Number(transaction.amount) || 0;
            const isEditing = editing === transaction.id;

            if (isEditing) {
              return (
                <tr key={transaction.id}>
                  <td>
                    <input
                      className="input"
                      type="date"
                      value={draft.occurredAt}
                      onChange={(e) => setDraft({ ...draft, occurredAt: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: 13 }}
                    />
                  </td>
                  <td>
                    <span className={type.className}>
                      <span aria-hidden="true">{type.mark}</span>
                      {type.label}
                    </span>
                  </td>
                  <td>
                    <select
                      className="input"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: 13 }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: 13 }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      style={{ padding: '6px 8px', fontSize: 13, width: 100, textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-primary" onClick={() => save(transaction)} disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}>
                        Salvar
                      </button>
                      <button className="btn" onClick={() => setEditing(null)} style={{ padding: '5px 10px', fontSize: 12 }}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={transaction.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(transaction.occurredAt)}</td>
                <td>
                  {/* cor + ícone + rótulo: o tipo nunca depende só da cor */}
                  <span className={type.className}>
                    <span aria-hidden="true">{type.mark}</span>
                    {type.label}
                  </span>
                </td>
                <td>{transaction.category}</td>
                <td style={{ color: 'var(--muted)' }}>
                  {transaction.description || '—'}
                  {transaction.installmentTotal && (
                    <span className="row-sub"> ({transaction.installmentNumber}/{transaction.installmentTotal})</span>
                  )}
                </td>
                <td
                  className="num"
                  style={{
                    color: transaction.type === 'income' ? 'var(--good-ink)' : 'var(--ink)',
                    fontWeight: 600
                  }}
                >
                  {privateMode ? '••••' : `${transaction.type === 'expense' ? '−' : ''}${formatMoney(amount)}`}
                </td>
                {editable && (
                  <td>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <button
                        className="icon-btn-sm"
                        onClick={() => startEdit(transaction)}
                        title="Editar"
                        aria-label={`Editar lançamento de ${transaction.category}`}
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn-sm"
                        onClick={() => remove(transaction)}
                        disabled={busy}
                        title="Apagar"
                        aria-label={`Apagar lançamento de ${transaction.category}`}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

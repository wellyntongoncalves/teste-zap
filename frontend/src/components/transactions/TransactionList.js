import React from 'react';
import { formatMoney, formatDate } from '../../format';

const TYPES = {
  income: { label: 'Receita', className: 'pill pill-income', mark: '↑' },
  expense: { label: 'Despesa', className: 'pill pill-expense', mark: '↓' },
  transfer: { label: 'Transferência', className: 'pill pill-transfer', mark: '↔' }
};

export default function TransactionList({ transactions, privateMode }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="empty">
        <div className="empty-mark">🧾</div>
        Nenhuma transação neste mês.
      </div>
    );
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
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const type = TYPES[transaction.type] || TYPES.transfer;
            const amount = Number(transaction.amount) || 0;
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
                <td style={{ color: 'var(--muted)' }}>{transaction.description || '—'}</td>
                <td
                  className="num"
                  style={{
                    color: transaction.type === 'income' ? 'var(--good-ink)' : 'var(--ink)',
                    fontWeight: 600
                  }}
                >
                  {privateMode ? '••••' : `${transaction.type === 'expense' ? '−' : ''}${formatMoney(amount)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

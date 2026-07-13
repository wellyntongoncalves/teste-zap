import React from 'react';

const TYPE_LABELS = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };
const TYPE_COLORS = { income: '#2e7d32', expense: '#c62828', transfer: '#455a64' };

export default function TransactionList({ transactions }) {
  if (transactions.length === 0) {
    return <p>Nenhuma transação neste mês.</p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={cellStyle}>Data</th>
          <th style={cellStyle}>Tipo</th>
          <th style={cellStyle}>Valor</th>
          <th style={cellStyle}>Categoria</th>
          <th style={cellStyle}>Descrição</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => (
          <tr key={transaction.id}>
            <td style={cellStyle}>{new Date(transaction.occurredAt).toLocaleDateString('pt-BR')}</td>
            <td style={{ ...cellStyle, color: TYPE_COLORS[transaction.type] }}>
              {TYPE_LABELS[transaction.type] || transaction.type}
            </td>
            <td style={cellStyle}>R$ {parseFloat(transaction.amount).toFixed(2)}</td>
            <td style={cellStyle}>{transaction.category}</td>
            <td style={cellStyle}>{transaction.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cellStyle = { border: '1px solid #ddd', padding: 8, textAlign: 'left' };

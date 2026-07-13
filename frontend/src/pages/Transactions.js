import React, { useEffect, useState } from 'react';
import api, { downloadFile } from '../api';
import TransactionList from '../components/transactions/TransactionList';
import NewTransactionForm from '../components/transactions/NewTransactionForm';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const today = new Date();
  const [month] = useState(today.getMonth() + 1);
  const [year] = useState(today.getFullYear());

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    const { data } = await api.get('/transactions', { params: { month, year } });
    setTransactions(data);
  }

  async function handleExport(format) {
    const extension = format === 'csv' ? 'csv' : 'pdf';
    await downloadFile(`/transactions/export/${format}?month=${month}&year=${year}`, `transacoes.${extension}`);
  }

  return (
    <div>
      <h2>Lançamentos</h2>

      <NewTransactionForm onCreated={loadTransactions} />

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => handleExport('csv')} style={{ marginRight: 8 }}>Exportar CSV</button>
        <button onClick={() => handleExport('pdf')}>Exportar PDF</button>
      </div>
      <TransactionList transactions={transactions} />
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { downloadFile } from '../api';
import TransactionList from '../components/transactions/TransactionList';
import NewTransactionForm from '../components/transactions/NewTransactionForm';
import MonthNav from '../components/layout/MonthNav';

const now = new Date();

export default function Transactions() {
  const { privateMode } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get('/transactions', { params: period });
    setTransactions(data);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  async function handleExport(format) {
    setExporting(format);
    try {
      await downloadFile(
        `/transactions/export/${format}?month=${period.month}&year=${period.year}`,
        `transacoes-${period.year}-${String(period.month).padStart(2, '0')}.${format}`
      );
    } finally {
      setExporting('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-head">
        <h1 className="h1">Lançamentos</h1>
        <NewTransactionForm onCreated={loadTransactions} />
      </div>

      <div className="page-head">
        <MonthNav month={period.month} year={period.year} onChange={setPeriod} />
        <div className="form-actions">
          <button className="btn" onClick={() => handleExport('csv')} disabled={exporting !== ''}>
            {exporting === 'csv' ? 'Exportando…' : 'CSV'}
          </button>
          <button className="btn" onClick={() => handleExport('pdf')} disabled={exporting !== ''}>
            {exporting === 'pdf' ? 'Exportando…' : 'PDF'}
          </button>
        </div>
      </div>

      <section className={`card ${loading ? 'is-loading' : ''}`}>
        <div className="card-head">
          <h2 className="h2">
            {transactions.length > 0 ? `${transactions.length} lançamentos` : 'Lançamentos do mês'}
          </h2>
        </div>
        <TransactionList
          transactions={transactions}
          privateMode={privateMode}
          onChanged={loadTransactions}
        />
      </section>
    </div>
  );
}

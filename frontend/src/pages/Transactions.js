import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { downloadFile } from '../api';
import TransactionList from '../components/transactions/TransactionList';
import NewTransactionForm from '../components/transactions/NewTransactionForm';

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export default function Transactions() {
  const { privateMode } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  // Estável entre renders: senão o efeito refaria a busca a cada render.
  const today = useMemo(() => new Date(), []);
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const loadTransactions = useCallback(async () => {
    const { data } = await api.get('/transactions', { params: { month, year } });
    setTransactions(data);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  async function handleExport(format) {
    setExporting(format);
    try {
      await downloadFile(`/transactions/export/${format}?month=${month}&year=${year}`, `transacoes.${format}`);
    } finally {
      setExporting('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="h1">Lançamentos</h1>
          <span className="muted" style={{ fontSize: 13 }}>{MONTH_LABEL.format(today)}</span>
        </div>
        <NewTransactionForm onCreated={loadTransactions} />
      </div>

      <section className={`card ${loading ? 'is-loading' : ''}`}>
        <div className="card-head">
          <h2 className="h2">
            {transactions.length > 0 ? `${transactions.length} lançamentos` : 'Lançamentos do mês'}
          </h2>
          <div className="form-actions">
            <button className="btn" onClick={() => handleExport('csv')} disabled={exporting !== ''}>
              {exporting === 'csv' ? 'Exportando…' : 'CSV'}
            </button>
            <button className="btn" onClick={() => handleExport('pdf')} disabled={exporting !== ''}>
              {exporting === 'pdf' ? 'Exportando…' : 'PDF'}
            </button>
          </div>
        </div>
        <TransactionList transactions={transactions} privateMode={privateMode} />
      </section>
    </div>
  );
}

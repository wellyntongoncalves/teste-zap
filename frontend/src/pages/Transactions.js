import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api, { downloadFile } from '../api';
import TransactionList from '../components/transactions/TransactionList';
import NewTransactionForm from '../components/transactions/NewTransactionForm';
import MonthNav from '../components/layout/MonthNav';

const now = new Date();

const TYPE_FILTERS = [
  { value: '', label: 'Tudo' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'transfer', label: 'Transferências' }
];

export default function Transactions() {
  const { privateMode } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    // A API já filtrava por type e accountId; só faltava a UI pedir.
    const { data } = await api.get('/transactions', {
      params: { ...period, ...(type ? { type } : {}), ...(accountId ? { accountId } : {}) }
    });
    setTransactions(data);
    setLoading(false);
  }, [period, type, accountId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    api.get('/accounts').then(({ data }) => setAccounts(data));
  }, []);

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

      {/* Um filtro só, acima de tudo que ele afeta — não um por card. */}
      <div className="page-head">
        <div className="toggle" role="group" aria-label="Filtrar por tipo">
          {TYPE_FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={type === f.value} onClick={() => setType(f.value)}>
              {f.label}
            </button>
          ))}
        </div>

        {accounts.length > 1 && (
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Filtrar por conta"
            style={{ width: 'auto', padding: '7px 30px 7px 11px', fontSize: 13 }}
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      <section className={`card ${loading ? 'is-loading' : ''}`}>
        <div className="card-head">
          <h2 className="h2">
            {transactions.length > 0 ? `${transactions.length} lançamentos` : 'Lançamentos do mês'}
          </h2>
          {(type || accountId) && (
            <button className="btn" onClick={() => { setType(''); setAccountId(''); }}>
              Limpar filtros
            </button>
          )}
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

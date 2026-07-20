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

// Placeholder da lista enquanto a primeira carga não volta — evita o flash de
// "nenhuma transação" e dá a forma do conteúdo real.
function SkeletonList() {
  // As mesmas colunas da lista real, na mesma ordem: no celular o CSS `stack`
  // rearranja as duas em cartão, então o placeholder já nasce com a forma certa.
  const cells = [
    { cls: 'c-date', width: 58 },
    { cls: 'c-type', width: 72 },
    { cls: 'c-desc', width: 120 },
    { cls: 'num c-amount', width: 72 }
  ];
  return (
    <div className="table-wrap" aria-hidden="true">
      <table className="data stack">
        <tbody>
          {Array.from({ length: 6 }).map((_, row) => (
            <tr key={row}>
              {cells.map((cell) => (
                <td key={cell.cls} className={cell.cls}>
                  <span
                    className="skeleton skeleton-line"
                    style={{ width: cell.width, marginLeft: cell.cls.includes('num') ? 'auto' : 0 }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Transactions() {
  const { privateMode } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  // ready = primeira carga concluída; antes disso mostramos skeleton em vez de
  // piscar "nenhuma transação" (que é falso enquanto os dados não chegaram).
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // A API já filtrava por type e accountId; só faltava a UI pedir.
      const { data } = await api.get('/transactions', {
        params: { ...period, ...(type ? { type } : {}), ...(accountId ? { accountId } : {}) }
      });
      setTransactions(data);
    } finally {
      // finally: mesmo se a requisição falhar, saímos do skeleton (senão fica
      // girando pra sempre) e paramos o loading.
      setLoading(false);
      setReady(true);
    }
  }, [period, type, accountId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    api.get('/accounts').then(({ data }) => setAccounts(data));
  }, []);

  async function handleExport(format) {
    setExporting(format);
    setExportError('');
    try {
      await downloadFile(
        `/transactions/export/${format}?month=${period.month}&year=${period.year}`,
        `transacoes-${period.year}-${String(period.month).padStart(2, '0')}.${format}`
      );
    } catch {
      // Sem isso, uma falha de rede/servidor virava rejeição silenciosa: o botão
      // voltava ao normal e o usuário ficava sem o arquivo e sem explicação.
      setExportError(`Não consegui gerar o ${format.toUpperCase()}. Tente de novo.`);
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

      {exportError && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{exportError}</span>
        </div>
      )}

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
        {ready ? (
          <TransactionList
            transactions={transactions}
            privateMode={privateMode}
            onChanged={loadTransactions}
          />
        ) : (
          <SkeletonList />
        )}
      </section>
    </div>
  );
}

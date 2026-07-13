import React, { useEffect, useState } from 'react';
import api from '../api';
import TransactionChart from '../components/transactions/TransactionChart';
import TransactionList from '../components/transactions/TransactionList';

export default function Home() {
  const [summary, setSummary] = useState({ total: 0, byCategory: [], totalIncome: 0, totalExpense: 0, net: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const today = new Date();
    const params = { month: today.getMonth() + 1, year: today.getFullYear() };

    api.get('/transactions/summary', { params }).then(({ data }) => setSummary(data));
    api.get('/transactions', { params }).then(({ data }) => setRecent(data.slice(0, 5)));
  }, []);

  return (
    <div>
      <h2>
        Receitas: R$ {summary.totalIncome.toFixed(2)} &nbsp;|&nbsp; Despesas: R$ {summary.totalExpense.toFixed(2)}{' '}
        &nbsp;|&nbsp; Saldo: R$ {summary.net.toFixed(2)}
      </h2>

      <section style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 24 }}>
        <div style={{ flex: '1 1 300px', maxWidth: 360 }}>
          <h3>Despesas por categoria</h3>
          <TransactionChart byCategory={summary.byCategory} />
        </div>
        <div style={{ flex: '2 1 400px' }}>
          <h3>Últimos lançamentos</h3>
          <TransactionList transactions={recent} />
        </div>
      </section>
    </div>
  );
}

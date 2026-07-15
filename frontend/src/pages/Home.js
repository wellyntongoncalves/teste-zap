import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import api from '../api';
import TransactionChart from '../components/transactions/TransactionChart';
import TransactionList from '../components/transactions/TransactionList';
import { formatMoney } from '../format';

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export default function Home() {
  const { user, privateMode } = useOutletContext();
  const [summary, setSummary] = useState({ byCategory: [], totalIncome: 0, totalExpense: 0, net: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estável entre renders: senão o efeito refaria a busca a cada render.
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const params = { month: today.getMonth() + 1, year: today.getFullYear() };

    Promise.all([
      api.get('/transactions/summary', { params }),
      api.get('/transactions', { params })
    ])
      .then(([summaryRes, listRes]) => {
        setSummary(summaryRes.data);
        setRecent(listRes.data.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, [today]);

  const money = (value) => (privateMode ? '••••••' : formatMoney(value));
  const net = Number(summary.net) || 0;
  const positive = net >= 0;

  return (
    <div className={loading ? 'is-loading' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero: o número que o painel lidera. Sans, figuras proporcionais. */}
      <section className="card" aria-label="Saldo do mês">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">Saldo de {MONTH_LABEL.format(today)}</span>
          <div
            className="hero-value"
            style={{ color: positive ? 'var(--good-ink)' : 'var(--critical-ink)' }}
          >
            {money(net)}
          </div>
          {/* polaridade nunca por cor sozinha: ícone + rótulo acompanham */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span aria-hidden="true">{positive ? '▲' : '▼'}</span>
            <span className="muted">
              {positive ? 'Você fechou o mês no positivo' : 'Suas despesas passaram das receitas'}
            </span>
          </div>
        </div>
      </section>

      <section className="kpi-row" aria-label="Resumo do mês">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-dot" style={{ background: 'var(--good)' }} aria-hidden="true" />
            <span className="label">Receitas</span>
          </div>
          <div className="kpi-value">{money(summary.totalIncome)}</div>
          <span className="kpi-sub">entradas no mês</span>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-dot" style={{ background: 'var(--critical)' }} aria-hidden="true" />
            <span className="label">Despesas</span>
          </div>
          <div className="kpi-value">{money(summary.totalExpense)}</div>
          <span className="kpi-sub">saídas no mês</span>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-dot" style={{ background: 'var(--brand)' }} aria-hidden="true" />
            <span className="label">Lançamentos</span>
          </div>
          <div className="kpi-value">{recent.length > 0 ? recent.length : '—'}</div>
          <span className="kpi-sub">
            <Link to="/lancamentos" style={{ color: 'var(--brand-ink)' }}>
              ver todos
            </Link>
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h2">Despesas por categoria</h2>
        </div>
        <div className="card-body">
          <TransactionChart byCategory={privateMode ? [] : summary.byCategory} />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h2">Últimos lançamentos</h2>
          <Link to="/lancamentos" className="btn">
            Ver todos
          </Link>
        </div>
        <TransactionList transactions={recent} privateMode={privateMode} />
      </section>

      {user?.name && (
        <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', margin: 0 }}>
          Conectado como {user.name}
        </p>
      )}
    </div>
  );
}

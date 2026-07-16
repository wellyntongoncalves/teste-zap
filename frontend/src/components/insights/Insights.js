import React, { useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';

export default function Insights({ privateMode }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/insights').then(({ data }) => setData(data)).catch(() => setData(null));
  }, []);

  if (!data) return null;

  const { recurring, monthlyRecurringCost, projection } = data;
  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  // Sem histórico não há padrão a mostrar — um card vazio só ocuparia espaço.
  if (recurring.length === 0) return null;

  const willEndNegative = projection.projected < 0;
  const expenses = recurring.filter((r) => r.type === 'expense');

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Padrões e projeção</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {projection.daysLeft > 0 ? `faltam ${projection.daysLeft} dias no mês` : 'último dia do mês'}
        </span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="page-head" style={{ marginBottom: 6 }}>
            <span className="label">Projeção pro fim do mês</span>
            <span
              className="row-value"
              style={{ color: willEndNegative ? 'var(--critical-ink)' : 'var(--good-ink)', fontSize: 20 }}
            >
              {money(projection.projected)}
            </span>
          </div>
          {/* a conta que gerou o número fica à vista — projeção sem memória de
              cálculo é adivinhação */}
          <p className="row-sub" style={{ margin: 0 }}>
            {money(projection.currentBalance)} agora
            {projection.expectedIncome > 0 && ` + ${money(projection.expectedIncome)} a receber`}
            {projection.expectedExpense > 0 && ` − ${money(projection.expectedExpense)} a pagar`}
          </p>
          {willEndNegative && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 10 }}>
              <span aria-hidden="true">⚠</span>
              <span>No ritmo atual o mês fecha no negativo.</span>
            </div>
          )}
        </div>

        {expenses.length > 0 && (
          <div>
            <div className="page-head" style={{ marginBottom: 10 }}>
              <span className="label">Cobranças que se repetem</span>
              <span className="row-sub">{money(monthlyRecurringCost)}/mês</span>
            </div>
            <div className="rows" style={{ margin: '0 -18px -18px' }}>
              {expenses.slice(0, 6).map((item) => (
                <div className="row" key={`${item.label}-${item.typicalDay}`}>
                  <div className="row-main">
                    <span className="row-title">{item.label}</span>
                    <span className="row-sub">
                      todo dia {item.typicalDay} · {item.category} · visto em {item.occurrences} meses
                    </span>
                  </div>
                  <span className="row-value">{money(item.typicalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

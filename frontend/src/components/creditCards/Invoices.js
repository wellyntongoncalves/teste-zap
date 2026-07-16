import React, { useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney, formatDate } from '../../format';

const PERIOD_LABEL = (period) => {
  const [year, month] = period.split('-');
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Invoices({ card, privateMode }) {
  const [invoices, setInvoices] = useState(null);
  const [openPeriod, setOpenPeriod] = useState(null);

  useEffect(() => {
    api
      .get(`/credit-cards/${card.id}/invoices`)
      .then(({ data }) => {
        setInvoices(data);
        // Abre a fatura do mês corrente, que é a que interessa ver primeiro.
        const atual = data.find((i) => i.period === currentPeriod());
        setOpenPeriod(atual ? atual.period : data[data.length - 1]?.period ?? null);
      })
      .catch(() => setInvoices([]));
  }, [card.id]);

  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  if (invoices === null) return null;

  if (invoices.length === 0) {
    return (
      <div className="empty" style={{ padding: '22px 18px' }}>
        Nenhuma compra lançada neste cartão ainda.
      </div>
    );
  }

  // Mais recentes primeiro: fatura velha interessa menos que a que vai vencer.
  const ordered = [...invoices].reverse();
  const limit = parseFloat(card.limitAmount);

  return (
    <div className="rows">
      {ordered.map((invoice) => {
        const isOpen = openPeriod === invoice.period;
        const usage = limit > 0 ? Math.min(100, (invoice.total / limit) * 100) : 0;
        const isCurrent = invoice.period === currentPeriod();

        return (
          <div key={invoice.period} style={{ borderBottom: '1px solid var(--line)' }}>
            <button
              type="button"
              className="row"
              onClick={() => setOpenPeriod(isOpen ? null : invoice.period)}
              aria-expanded={isOpen}
              style={{ width: '100%', border: 0, borderBottom: 0, background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            >
              <div className="row-main">
                <span className="row-title" style={{ textTransform: 'capitalize' }}>
                  {PERIOD_LABEL(invoice.period)}
                  {isCurrent && (
                    <span className="pill pill-transfer" style={{ marginLeft: 8 }}>
                      <span aria-hidden="true">●</span> Atual
                    </span>
                  )}
                </span>
                <span className="row-sub">
                  {invoice.transactions.length} {invoice.transactions.length === 1 ? 'compra' : 'compras'} · vence dia {card.dueDay}
                </span>
              </div>
              <span className="row-value">{money(invoice.total)}</span>
              <span className="muted" aria-hidden="true" style={{ fontSize: 13 }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {limit > 0 && (
                  <div>
                    <div className="page-head" style={{ marginBottom: 5 }}>
                      <span className="row-sub">{usage.toFixed(0)}% do limite</span>
                      <span className="row-sub">limite {money(limit)}</span>
                    </div>
                    <div className="meter" role="img" aria-label={`${usage.toFixed(0)}% do limite usado`}>
                      <i style={{ width: `${usage}%` }} />
                    </div>
                  </div>
                )}

                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {invoice.transactions.map((t) => (
                        <tr key={t.id}>
                          <td style={{ whiteSpace: 'nowrap', width: 1 }}>{formatDate(t.occurredAt)}</td>
                          <td>
                            {t.description || t.category}
                            {t.installmentTotal && (
                              <span className="row-sub"> ({t.installmentNumber}/{t.installmentTotal})</span>
                            )}
                          </td>
                          <td className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {money(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

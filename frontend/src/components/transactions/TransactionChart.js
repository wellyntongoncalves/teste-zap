import React, { useState } from 'react';
import { formatMoney } from '../../format';

// Comparar magnitude entre categorias de nome longo => barra horizontal
// ranqueada, uma série => uma cor. (Uma pizza esconde valores próximos e
// gastaria 8 matizes para informação que o comprimento da barra já dá.)
//
// Teto de 7 classes: a cauda vira "Outros" em vez de virar mais cores.
const MAX_BARS = 7;

function fold(byCategory) {
  const sorted = [...byCategory]
    .map((item) => ({ category: item.category, total: Number(item.total) || 0 }))
    .sort((a, b) => b.total - a.total);

  if (sorted.length <= MAX_BARS) return sorted;

  const head = sorted.slice(0, MAX_BARS - 1);
  const tail = sorted.slice(MAX_BARS - 1);
  head.push({
    category: `Outros (${tail.length})`,
    total: tail.reduce((sum, item) => sum + item.total, 0)
  });
  return head;
}

export default function TransactionChart({ byCategory }) {
  const [view, setView] = useState('chart');

  if (!byCategory || byCategory.length === 0) {
    return (
      <div className="empty">
        <div className="empty-mark">📊</div>
        Sem despesas registradas neste mês.
      </div>
    );
  }

  const rows = fold(byCategory);
  const max = Math.max(...rows.map((r) => r.total));
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const pct = (value) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div className="toggle" role="group" aria-label="Formato de exibição">
          <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            Gráfico
          </button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Tabela
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="bars">
          {rows.map((row) => (
            // title = tooltip nativo; o valor exato também está rotulado e na tabela,
            // então o hover enriquece mas nunca é o único caminho pro dado.
            <div className="bar-row" key={row.category} title={`${row.category}: ${formatMoney(row.total)}`}>
              <div className="bar-meta">
                <span className="bar-name">{row.category}</span>
                <span className="bar-val">
                  {formatMoney(row.total)}
                  <span className="bar-pct">{pct(row.total).toFixed(0)}%</span>
                </span>
              </div>
              <div
                className="bar-track"
                role="img"
                aria-label={`${row.category}: ${formatMoney(row.total)}, ${pct(row.total).toFixed(0)}% das despesas`}
              >
                <div className="bar-fill" style={{ width: `${max > 0 ? (row.total / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Categoria</th>
                <th className="num">Valor</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="num">{formatMoney(row.total)}</td>
                  <td className="num">{pct(row.total).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React from 'react';

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

// Navegação de mês compartilhada entre Início e Lançamentos — as duas telas
// mostravam só o mês corrente, sem jeito de ver o histórico.
export default function MonthNav({ month, year, onChange }) {
  const current = new Date(year, month - 1, 1);
  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  function shift(delta) {
    const next = new Date(year, month - 1 + delta, 1);
    onChange({ month: next.getMonth() + 1, year: next.getFullYear() });
  }

  return (
    <div className="month-nav">
      <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
        ‹
      </button>
      <span className="month-nav-label">{MONTH_LABEL.format(current)}</span>
      {/* Sem limite pra frente o usuário se perde em meses vazios sem perceber. */}
      <button
        type="button"
        className="icon-btn"
        onClick={() => shift(1)}
        disabled={isCurrentMonth}
        aria-label="Próximo mês"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          type="button"
          className="btn"
          onClick={() => onChange({ month: now.getMonth() + 1, year: now.getFullYear() })}
        >
          Hoje
        </button>
      )}
    </div>
  );
}

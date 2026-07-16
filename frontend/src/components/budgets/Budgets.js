import React, { useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Compras',
  'Salário', 'Investimentos', 'Outras Receitas', 'Outros'
];

export default function Budgets({ privateMode }) {
  const [status, setStatus] = useState([]);
  const [tags, setTags] = useState([]);
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStatus();
    api.get('/tags').then(({ data }) => setTags(data));
  }, []);

  async function loadStatus() {
    const { data } = await api.get('/budgets/status');
    setStatus(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    // O select mistura categorias e tags; o prefixo "tag:" desambigua na hora
    // de montar o payload (a API exige exatamente um dos dois).
    const isTag = target.startsWith('tag:');
    const payload = {
      amount: parseFloat(amount),
      ...(isTag ? { tagId: target.slice(4) } : { category: target })
    };

    try {
      await api.post('/budgets', payload);
      setTarget('');
      setAmount('');
      setOpen(false);
      loadStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar o orçamento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(budget, label) {
    if (!window.confirm(`Remover o orçamento de "${label}"?`)) return;
    await api.delete(`/budgets/${budget.id}`);
    loadStatus();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Orçamentos do mês</h2>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <span aria-hidden="true">+</span> Novo orçamento
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleCreate} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, borderBottom: '1px solid var(--line)' }}>
          {error && (
            <div className="alert alert-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="bud-target">Categoria ou tag</label>
              <select id="bud-target" value={target} onChange={(e) => setTarget(e.target.value)} required>
                <option value="" disabled>Selecione…</option>
                <optgroup label="Categorias">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
                {tags.length > 0 && (
                  <optgroup label="Tags">
                    {tags.map((t) => (
                      <option key={t.id} value={`tag:${t.id}`}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bud-amount">Valor mensal</label>
              <input id="bud-amount" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar orçamento'}
            </button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
          </div>
        </form>
      )}

      {status.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">🎚️</div>
          Nenhum orçamento definido. Defina um teto por categoria e acompanhe o quanto já foi.
        </div>
      ) : (
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {status.map((budget) => {
            const label = budget.category || budget.tag?.name || 'Orçamento';
            const pct = budget.amount > 0 ? Math.min(100, (budget.spent / budget.amount) * 100) : 0;
            const over = budget.spent > budget.amount;

            return (
              <div key={budget.id} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div className="page-head" style={{ gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="row-title">{label}</span>
                    {/* estouro carrega ícone + rótulo, nunca só a cor da barra */}
                    {over && (
                      <span className="pill pill-expense">
                        <span aria-hidden="true">!</span> Estourou
                      </span>
                    )}
                  </div>
                  <span className="row-value">
                    {money(budget.spent)} <span className="muted" style={{ fontWeight: 400 }}>de {money(budget.amount)}</span>
                  </span>
                </div>

                <div
                  className={`meter ${over ? 'is-over' : ''}`}
                  role="img"
                  aria-label={`${label}: ${pct.toFixed(0)}% do orçamento usado`}
                >
                  <i style={{ width: `${pct}%` }} />
                </div>

                <div className="page-head" style={{ gap: 8 }}>
                  <span className="row-sub">
                    {over
                      ? `${money(budget.spent - budget.amount)} acima do planejado`
                      : `restam ${money(budget.remaining)}`}
                  </span>
                  <button
                    type="button"
                    className="icon-btn-sm"
                    onClick={() => handleDelete(budget, label)}
                    title={`Remover orçamento de ${label}`}
                    aria-label={`Remover orçamento de ${label}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

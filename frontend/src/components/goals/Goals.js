import React, { useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';

const EMPTY_FORM = { name: '', targetAmount: '', linkedAccountId: '' };

export default function Goals({ privateMode }) {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contributing, setContributing] = useState(null); // goal.id com o aporte aberto
  const [contribution, setContribution] = useState('');

  useEffect(() => {
    loadGoals();
    api.get('/accounts').then(({ data }) => setAccounts(data));
  }, []);

  async function loadGoals() {
    const { data } = await api.get('/goals');
    setGoals(data);
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/goals', {
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        linkedAccountId: form.linkedAccountId || null
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      loadGoals();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar a meta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleContribute(e, goal) {
    e.preventDefault();
    const amount = parseFloat(contribution);
    if (!amount || amount <= 0) return;

    await api.post(`/goals/${goal.id}/contributions`, { amount });
    setContributing(null);
    setContribution('');
    loadGoals();
  }

  async function handleArchive(goal) {
    if (!window.confirm(`Arquivar a meta "${goal.name}"?`)) return;
    await api.delete(`/goals/${goal.id}`);
    loadGoals();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Metas</h2>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <span aria-hidden="true">+</span> Nova meta
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
              <label htmlFor="goal-name">Nome da meta</label>
              <input id="goal-name" placeholder="Ex: Viagem em dezembro" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="goal-target">Valor alvo</label>
              <input id="goal-target" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" value={form.targetAmount} onChange={(e) => set('targetAmount', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="goal-account">Conta vinculada</label>
              <select id="goal-account" value={form.linkedAccountId} onChange={(e) => set('linkedAccountId', e.target.value)}>
                <option value="">Nenhuma</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar meta'}
            </button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">🎯</div>
          Nenhuma meta ainda. Crie uma para acompanhar o quanto falta.
        </div>
      ) : (
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {goals.map((goal) => {
            const target = parseFloat(goal.targetAmount);
            const current = parseFloat(goal.currentAmount);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            const done = goal.status === 'completed';
            const remaining = Math.max(0, target - current);

            return (
              <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="page-head" style={{ gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="row-title">{goal.name}</span>
                    {/* concluída carrega ícone + rótulo, não só a cor da barra */}
                    {done && (
                      <span className="pill pill-income">
                        <span aria-hidden="true">✓</span> Concluída
                      </span>
                    )}
                  </div>
                  <span className="row-value">
                    {money(current)} <span className="muted" style={{ fontWeight: 400 }}>de {money(target)}</span>
                  </span>
                </div>

                <div
                  className="meter"
                  role="img"
                  aria-label={`${goal.name}: ${pct.toFixed(0)}% concluída`}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: '0 4px 4px 0',
                      background: done ? 'var(--good)' : 'var(--brand)',
                      transition: 'width .5s cubic-bezier(.2,.7,.2,1)'
                    }}
                  />
                </div>

                <div className="page-head" style={{ gap: 8 }}>
                  <span className="row-sub">
                    {done ? 'Meta batida 🎉' : `${pct.toFixed(0)}% — faltam ${money(remaining)}`}
                  </span>

                  <div className="form-actions">
                    {contributing === goal.id ? (
                      <form onSubmit={(e) => handleContribute(e, goal)} className="form-actions">
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          placeholder="Valor"
                          value={contribution}
                          onChange={(e) => setContribution(e.target.value)}
                          style={{ width: 120 }}
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary">Adicionar</button>
                        <button type="button" className="btn" onClick={() => { setContributing(null); setContribution(''); }}>
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <>
                        {!done && (
                          <button type="button" className="btn" onClick={() => { setContributing(goal.id); setContribution(''); }}>
                            Contribuir
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn-sm"
                          onClick={() => handleArchive(goal)}
                          title={`Arquivar ${goal.name}`}
                          aria-label={`Arquivar ${goal.name}`}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

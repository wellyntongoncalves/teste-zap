import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';

const TYPE_LABELS = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  investimento: 'Investimento',
  outra: 'Outra'
};

const EMPTY_FORM = { name: '', type: 'carteira', initialBalance: '' };

export default function Accounts({ privateMode }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadAccounts = useCallback(async () => {
    const { data } = await api.get('/accounts', { params: { includeArchived: showArchived } });
    setAccounts(data);
  }, [showArchived]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/accounts', {
        name: form.name,
        type: form.type,
        initialBalance: form.initialBalance ? parseFloat(form.initialBalance) : 0
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      loadAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar a conta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(account) {
    if (!window.confirm(`Arquivar a conta "${account.name}"? Ela sai da lista, mas os lançamentos ficam e você pode restaurá-la depois.`)) return;
    await api.delete(`/accounts/${account.id}`);
    loadAccounts();
  }

  async function handleRestore(account) {
    await api.patch(`/accounts/${account.id}`, { archived: false });
    loadAccounts();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));
  // Conta arquivada não entra no total — ela não faz parte do seu dinheiro hoje.
  const total = accounts
    .filter((a) => !a.archivedAt)
    .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Contas</h2>
        <div className="form-actions">
          <button
            type="button"
            className="chip"
            aria-pressed={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            Arquivadas
          </button>
          {!open && (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              <span aria-hidden="true">+</span> Nova conta
            </button>
          )}
        </div>
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
              <label htmlFor="acc-name">Nome</label>
              <input id="acc-name" placeholder="Ex: Nubank" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="acc-type">Tipo</label>
              <select id="acc-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="acc-balance">Saldo inicial</label>
              <input id="acc-balance" type="number" step="0.01" inputMode="decimal" placeholder="0,00" value={form.initialBalance} onChange={(e) => set('initialBalance', e.target.value)} />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Adicionar conta'}
            </button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">🏦</div>
          Nenhuma conta ativa.
        </div>
      ) : (
        <>
          <div className="rows">
            {accounts.map((account) => {
              const archived = Boolean(account.archivedAt);

              return (
                <div className="row" key={account.id} style={{ opacity: archived ? 0.6 : 1 }}>
                  <div className="row-main">
                    <span className="row-title">
                      {account.name}
                      {/* arquivada carrega rótulo, não só a opacidade */}
                      {archived && (
                        <span className="pill pill-transfer" style={{ marginLeft: 8 }}>
                          Arquivada
                        </span>
                      )}
                    </span>
                    <span className="row-sub">{TYPE_LABELS[account.type] || account.type}</span>
                  </div>
                  <span
                    className="row-value"
                    style={{ color: Number(account.balance) < 0 ? 'var(--critical-ink)' : 'var(--ink)' }}
                  >
                    {money(account.balance)}
                  </span>
                  {archived ? (
                    <button type="button" className="btn" onClick={() => handleRestore(account)} style={{ padding: '5px 10px', fontSize: 12 }}>
                      Restaurar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={() => handleArchive(account)}
                      title={`Arquivar ${account.name}`}
                      aria-label={`Arquivar ${account.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="card-body" style={{ borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
            <span className="label">Total</span>
            <span className="row-value">{money(total)}</span>
          </div>
        </>
      )}
    </section>
  );
}

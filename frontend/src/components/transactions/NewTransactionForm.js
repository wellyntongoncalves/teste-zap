import React, { useEffect, useState } from 'react';
import api from '../../api';
import { CATEGORIES } from '../../constants';

const TYPES = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'transfer', label: 'Transferência' }
];

const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  category: 'Outros',
  description: '',
  accountId: '',
  destinationAccountId: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  creditCardId: '',
  installments: '',
  tags: []
};

export default function NewTransactionForm({ onCreated }) {
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/accounts').then(({ data }) => setAccounts(data));
    api.get('/tags').then(({ data }) => setTags(data));
    api.get('/credit-cards').then(({ data }) => setCreditCards(data));
  }, []);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId) ? prev.tags.filter((id) => id !== tagId) : [...prev.tags, tagId]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/transactions', {
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description,
        accountId: form.accountId,
        destinationAccountId: form.type === 'transfer' ? form.destinationAccountId : undefined,
        occurredAt: form.occurredAt,
        // Cartão e parcelas só valem pra despesa. Sem isso, trocar o tipo depois de
        // escolher um cartão vazava esses campos e criava, ex., uma receita parcelada.
        creditCardId: form.type === 'expense' ? (form.creditCardId || undefined) : undefined,
        installments:
          form.type === 'expense' && form.installments ? parseInt(form.installments, 10) : undefined,
        tags: form.tags
      });

      setForm({ ...EMPTY_FORM, occurredAt: new Date().toISOString().slice(0, 10) });
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui salvar. Confira os campos e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Novo lançamento
      </button>
    );
  }

  const isTransfer = form.type === 'transfer';

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-head">
        <h2 className="h2">Novo lançamento</h2>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="toggle" role="group" aria-label="Tipo de lançamento">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={form.type === t.value}
              onClick={() => set('type', t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="amount">Valor</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="occurredAt">Data</label>
            <input
              id="occurredAt"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          {/* Transferência move dinheiro entre contas suas — não tem categoria de gasto. */}
          {!isTransfer && (
            <div className="field">
              <label htmlFor="category">Categoria</label>
              <select id="category" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="accountId">{isTransfer ? 'Conta de origem' : 'Conta'}</label>
            <select id="accountId" value={form.accountId} onChange={(e) => set('accountId', e.target.value)} required>
              <option value="" disabled>Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {isTransfer && (
            <div className="field">
              <label htmlFor="destinationAccountId">Conta de destino</label>
              <select
                id="destinationAccountId"
                value={form.destinationAccountId}
                onChange={(e) => set('destinationAccountId', e.target.value)}
                required
              >
                <option value="" disabled>Selecione…</option>
                {accounts
                  .filter((a) => a.id !== form.accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </select>
            </div>
          )}

          {form.type === 'expense' && creditCards.length > 0 && (
            <div className="field">
              <label htmlFor="creditCardId">Cartão</label>
              <select id="creditCardId" value={form.creditCardId} onChange={(e) => set('creditCardId', e.target.value)}>
                <option value="">Sem cartão</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.creditCardId && (
            <div className="field">
              <label htmlFor="installments">Parcelas</label>
              <input
                id="installments"
                type="number"
                min="2"
                placeholder="à vista"
                value={form.installments}
                onChange={(e) => set('installments', e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">Descrição</label>
          <input
            id="description"
            placeholder="Opcional — ex: mercado da esquina"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        {tags.length > 0 && (
          <div className="field">
            <label>Tags</label>
            <div className="chips">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="chip"
                  aria-pressed={form.tags.includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar lançamento'}
          </button>
        </div>
      </div>
    </form>
  );
}

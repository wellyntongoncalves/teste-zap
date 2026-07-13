import React, { useEffect, useState } from 'react';
import api from '../../api';

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Compras',
  'Salário', 'Investimentos', 'Outras Receitas', 'Outros'
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

  useEffect(() => {
    api.get('/accounts').then(({ data }) => setAccounts(data));
    api.get('/tags').then(({ data }) => setTags(data));
    api.get('/credit-cards').then(({ data }) => setCreditCards(data));
  }, []);

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId) ? prev.tags.filter((id) => id !== tagId) : [...prev.tags, tagId]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/transactions', {
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description,
        accountId: form.accountId,
        destinationAccountId: form.type === 'transfer' ? form.destinationAccountId : undefined,
        occurredAt: form.occurredAt,
        creditCardId: form.creditCardId || undefined,
        installments: form.installments ? parseInt(form.installments, 10) : undefined,
        tags: form.tags
      });

      setForm(EMPTY_FORM);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar transação');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420, marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ padding: 6 }}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
          <option value="transfer">Transferência</option>
        </select>
        <input
          placeholder="Valor"
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={{ padding: 6, flex: 1 }}
          required
        />
      </div>

      {form.type !== 'transfer' && (
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ padding: 6 }}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <input
        placeholder="Descrição"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        style={{ padding: 6 }}
      />

      <select
        value={form.accountId}
        onChange={(e) => setForm({ ...form, accountId: e.target.value })}
        style={{ padding: 6 }}
        required
      >
        <option value="" disabled>{form.type === 'transfer' ? 'Conta de origem' : 'Conta'}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      {form.type === 'transfer' && (
        <select
          value={form.destinationAccountId}
          onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })}
          style={{ padding: 6 }}
          required
        >
          <option value="" disabled>Conta de destino</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}

      <input
        type="date"
        value={form.occurredAt}
        onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
        style={{ padding: 6 }}
      />

      {form.type === 'expense' && creditCards.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={form.creditCardId}
            onChange={(e) => setForm({ ...form, creditCardId: e.target.value })}
            style={{ padding: 6, flex: 1 }}
          >
            <option value="">Sem cartão</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {form.creditCardId && (
            <input
              placeholder="Parcelas"
              type="number"
              min="2"
              value={form.installments}
              onChange={(e) => setForm({ ...form, installments: e.target.value })}
              style={{ padding: 6, width: 90 }}
            />
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div>
          {tags.map((tag) => (
            <label key={tag.id} style={{ marginRight: 12 }}>
              <input
                type="checkbox"
                checked={form.tags.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
              />{' '}
              {tag.name}
            </label>
          ))}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">Adicionar transação</button>
    </form>
  );
}

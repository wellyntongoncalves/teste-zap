import React, { useEffect, useState } from 'react';
import api from '../../api';

const CATEGORIES = [
  'Alimentação', 'Transporte', 'Contas', 'Saúde', 'Lazer', 'Educação', 'Compras',
  'Salário', 'Investimentos', 'Outras Receitas', 'Outros'
];

export default function Budgets() {
  const [status, setStatus] = useState([]);
  const [tags, setTags] = useState([]);
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

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

    const isTag = target.startsWith('tag:');
    const payload = {
      amount: parseFloat(amount),
      ...(isTag ? { tagId: target.slice(4) } : { category: target })
    };

    try {
      await api.post('/budgets', payload);
      setTarget('');
      setAmount('');
      loadStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar orçamento');
    }
  }

  return (
    <div>
      <h3>Orçamentos do mês</h3>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={target} onChange={(e) => setTarget(e.target.value)} required style={{ padding: 6 }}>
          <option value="" disabled>Categoria ou tag</option>
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
        <input
          placeholder="Valor mensal"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ padding: 6, width: 120 }}
          required
        />
        <button type="submit">Criar orçamento</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {status.map((budget) => {
        const label = budget.category || budget.tag?.name || 'Orçamento';
        const pct = budget.amount > 0 ? Math.min(100, (budget.spent / budget.amount) * 100) : 0;
        const over = budget.spent > budget.amount;

        return (
          <div key={budget.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{label}</span>
              <span>R$ {budget.spent.toFixed(2)} / R$ {budget.amount.toFixed(2)}</span>
            </div>
            <div style={{ background: '#eee', height: 8, borderRadius: 4 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: over ? '#c62828' : '#4e79a7'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

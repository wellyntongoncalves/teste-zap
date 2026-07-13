import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', targetAmount: '', linkedAccountId: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadGoals();
    api.get('/accounts').then(({ data }) => setAccounts(data));
  }, []);

  async function loadGoals() {
    const { data } = await api.get('/goals');
    setGoals(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/goals', {
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        linkedAccountId: form.linkedAccountId || null
      });
      setForm({ name: '', targetAmount: '', linkedAccountId: '' });
      loadGoals();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar meta');
    }
  }

  async function handleContribute(goal) {
    const amount = window.prompt(`Quanto deseja adicionar à meta "${goal.name}"?`);
    if (!amount) return;

    await api.post(`/goals/${goal.id}/contributions`, { amount: parseFloat(amount) });
    loadGoals();
  }

  async function handleArchive(id) {
    await api.delete(`/goals/${id}`);
    loadGoals();
  }

  return (
    <div>
      <h3>Metas financeiras</h3>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Nome da meta"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ padding: 6 }}
          required
        />
        <input
          placeholder="Valor alvo"
          type="number"
          value={form.targetAmount}
          onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
          style={{ padding: 6, width: 120 }}
          required
        />
        <select
          value={form.linkedAccountId}
          onChange={(e) => setForm({ ...form, linkedAccountId: e.target.value })}
          style={{ padding: 6 }}
        >
          <option value="">Sem conta vinculada</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button type="submit">Criar meta</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {goals.map((goal) => {
        const target = parseFloat(goal.targetAmount);
        const current = parseFloat(goal.currentAmount);
        const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;

        return (
          <div key={goal.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{goal.name} {goal.status === 'completed' && '✓'}</span>
              <span>R$ {current.toFixed(2)} / R$ {target.toFixed(2)}</span>
            </div>
            <div style={{ background: '#eee', height: 8, borderRadius: 4, marginBottom: 4 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: goal.status === 'completed' ? '#2e7d32' : '#4e79a7'
                }}
              />
            </div>
            <button onClick={() => handleContribute(goal)} style={{ marginRight: 8 }}>Contribuir</button>
            <button onClick={() => handleArchive(goal.id)}>Arquivar</button>
          </div>
        );
      })}
    </div>
  );
}

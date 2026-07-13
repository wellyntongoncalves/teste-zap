import React, { useEffect, useState } from 'react';
import api from '../../api';

const TYPE_LABELS = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  investimento: 'Investimento',
  outra: 'Outra'
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'carteira', initialBalance: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const { data } = await api.get('/accounts');
    setAccounts(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounts', {
        name: form.name,
        type: form.type,
        initialBalance: form.initialBalance ? parseFloat(form.initialBalance) : 0
      });
      setForm({ name: '', type: 'carteira', initialBalance: '' });
      loadAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar conta');
    }
  }

  async function handleArchive(id) {
    await api.delete(`/accounts/${id}`);
    loadAccounts();
  }

  return (
    <div>
      <h3>Contas</h3>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ padding: 6 }}
          required
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          style={{ padding: 6 }}
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          placeholder="Saldo inicial"
          type="number"
          value={form.initialBalance}
          onChange={(e) => setForm({ ...form, initialBalance: e.target.value })}
          style={{ padding: 6, width: 130 }}
        />
        <button type="submit">Adicionar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {accounts.map((account) => (
          <li key={account.id} style={{ marginBottom: 6 }}>
            <strong>{account.name}</strong> ({TYPE_LABELS[account.type] || account.type}) — saldo R${' '}
            {parseFloat(account.balance).toFixed(2)}{' '}
            <button onClick={() => handleArchive(account.id)}>Arquivar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

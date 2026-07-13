import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function CreditCards() {
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState({ name: '', limitAmount: '', closingDay: '', dueDay: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    const { data } = await api.get('/credit-cards');
    setCards(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/credit-cards', {
        name: form.name,
        limitAmount: parseFloat(form.limitAmount),
        closingDay: parseInt(form.closingDay, 10),
        dueDay: parseInt(form.dueDay, 10)
      });
      setForm({ name: '', limitAmount: '', closingDay: '', dueDay: '' });
      loadCards();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao criar cartão');
    }
  }

  async function handleArchive(id) {
    await api.delete(`/credit-cards/${id}`);
    loadCards();
  }

  return (
    <div>
      <h3>Cartões de crédito</h3>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ padding: 6 }}
          required
        />
        <input
          placeholder="Limite"
          type="number"
          value={form.limitAmount}
          onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
          style={{ padding: 6, width: 100 }}
          required
        />
        <input
          placeholder="Dia fechamento"
          type="number"
          min="1"
          max="31"
          value={form.closingDay}
          onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
          style={{ padding: 6, width: 130 }}
          required
        />
        <input
          placeholder="Dia vencimento"
          type="number"
          min="1"
          max="31"
          value={form.dueDay}
          onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
          style={{ padding: 6, width: 130 }}
          required
        />
        <button type="submit">Adicionar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cards.map((card) => (
          <li key={card.id} style={{ marginBottom: 6 }}>
            <strong>{card.name}</strong> — limite R$ {parseFloat(card.limitAmount).toFixed(2)}, fecha dia{' '}
            {card.closingDay}, vence dia {card.dueDay}{' '}
            <button onClick={() => handleArchive(card.id)}>Arquivar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

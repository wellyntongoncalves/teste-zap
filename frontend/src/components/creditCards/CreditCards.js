import React, { useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';

const EMPTY_FORM = { name: '', limitAmount: '', closingDay: '', dueDay: '' };

export default function CreditCards({ privateMode }) {
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    const { data } = await api.get('/credit-cards');
    setCards(data);
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/credit-cards', {
        name: form.name,
        limitAmount: parseFloat(form.limitAmount),
        closingDay: parseInt(form.closingDay, 10),
        dueDay: parseInt(form.dueDay, 10)
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      loadCards();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar o cartão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(card) {
    if (!window.confirm(`Arquivar o cartão "${card.name}"? Os lançamentos dele continuam no histórico.`)) return;
    await api.delete(`/credit-cards/${card.id}`);
    loadCards();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Cartões de crédito</h2>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <span aria-hidden="true">+</span> Novo cartão
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
              <label htmlFor="card-name">Nome</label>
              <input id="card-name" placeholder="Ex: Nubank" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="card-limit">Limite</label>
              <input id="card-limit" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" value={form.limitAmount} onChange={(e) => set('limitAmount', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="card-closing">Dia do fechamento</label>
              <input id="card-closing" type="number" min="1" max="31" placeholder="10" value={form.closingDay} onChange={(e) => set('closingDay', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="card-due">Dia do vencimento</label>
              <input id="card-due" type="number" min="1" max="31" placeholder="17" value={form.dueDay} onChange={(e) => set('dueDay', e.target.value)} required />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Adicionar cartão'}
            </button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(''); }}>Cancelar</button>
          </div>
        </form>
      )}

      {cards.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">💳</div>
          Nenhum cartão cadastrado. Cadastre um para acompanhar as faturas.
        </div>
      ) : (
        <div className="rows">
          {cards.map((card) => (
            <div className="row" key={card.id}>
              <div className="row-main">
                <span className="row-title">{card.name}</span>
                <span className="row-sub">Fecha dia {card.closingDay} · vence dia {card.dueDay}</span>
              </div>
              <span className="row-value">{money(card.limitAmount)}</span>
              <button
                type="button"
                className="icon-btn-sm"
                onClick={() => handleArchive(card)}
                title={`Arquivar ${card.name}`}
                aria-label={`Arquivar ${card.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

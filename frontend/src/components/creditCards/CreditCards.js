import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney } from '../../format';
import Invoices from './Invoices';

const EMPTY_FORM = { name: '', limitAmount: '', closingDay: '', dueDay: '' };

export default function CreditCards({ privateMode }) {
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadCards = useCallback(async () => {
    const { data } = await api.get('/credit-cards', { params: { includeArchived: showArchived } });
    setCards(data);
  }, [showArchived]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

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
    if (!window.confirm(`Arquivar o cartão "${card.name}"? Ele sai da lista, mas as faturas ficam e você pode restaurá-lo depois.`)) return;
    await api.delete(`/credit-cards/${card.id}`);
    loadCards();
  }

  async function handleRestore(card) {
    await api.patch(`/credit-cards/${card.id}`, { archived: false });
    loadCards();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Cartões de crédito</h2>
        <div className="form-actions">
          <button
            type="button"
            className="chip"
            aria-pressed={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            Arquivados
          </button>
          {!open && (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              <span aria-hidden="true">+</span> Novo cartão
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
          {cards.map((card) => {
            const isOpen = expanded === card.id;
            const archived = Boolean(card.archivedAt);

            return (
              <div key={card.id} style={{ borderBottom: '1px solid var(--line)', opacity: archived ? 0.6 : 1 }}>
                <div className="row" style={{ border: 0 }}>
                  <button
                    type="button"
                    className="row-main"
                    onClick={() => setExpanded(isOpen ? null : card.id)}
                    aria-expanded={isOpen}
                    style={{ border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', flex: 1, padding: 0 }}
                  >
                    <span className="row-title">
                      {card.name} <span className="muted" aria-hidden="true" style={{ fontSize: 12 }}>{isOpen ? '▾' : '▸'}</span>
                      {/* arquivado carrega rótulo, não só a opacidade */}
                      {archived && (
                        <span className="pill pill-transfer" style={{ marginLeft: 8 }}>Arquivado</span>
                      )}
                    </span>
                    <span className="row-sub">Fecha dia {card.closingDay} · vence dia {card.dueDay} · ver faturas</span>
                  </button>
                  <span className="row-value">{money(card.limitAmount)}</span>
                  {archived ? (
                    <button type="button" className="btn" onClick={() => handleRestore(card)} style={{ padding: '5px 10px', fontSize: 12 }}>
                      Restaurar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn-sm"
                      onClick={() => handleArchive(card)}
                      title={`Arquivar ${card.name}`}
                      aria-label={`Arquivar ${card.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {isOpen && <Invoices card={card} privateMode={privateMode} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

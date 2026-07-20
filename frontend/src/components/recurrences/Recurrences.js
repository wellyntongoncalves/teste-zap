import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { formatMoney, todayISO } from '../../format';
import { CATEGORIES } from '../../constants';

const EMPTY_FORM = {
  description: '',
  amount: '',
  type: 'expense',
  category: 'Contas',
  dayOfMonth: '5',
  accountId: '',
  endDate: ''
};

// "2026-08-10" -> "10 de ago". Data pura, sem hora: fatiar a string evita que o
// fuso do navegador puxe o dia pra trás (o clássico off-by-one).
function formatDue(iso) {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC'
  });
}

// Quantos dias faltam, em dias de calendário — o que importa é a distância entre
// as datas, não as horas entre elas.
function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((target - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function dueLabel(iso) {
  const days = daysUntil(iso);
  if (days === null) return 'sem próxima cobrança';
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  return `vence em ${formatDue(iso)} · em ${days} dias`;
}

export default function Recurrences({ privateMode, onChanged }) {
  const [rules, setRules] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySuggestion, setBusySuggestion] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/recurrences');
      setRules(data);

      // Sugestões são um extra: se falharem, a lista de contas fixas continua.
      try {
        const { data: found } = await api.get('/recurrences/suggestions');
        setSuggestions(found);
      } catch {
        setSuggestions([]);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/accounts').then(({ data }) => setAccounts(data));
  }, [load]);

  function field(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/recurrences', {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        category: form.category,
        dayOfMonth: parseInt(form.dayOfMonth, 10),
        accountId: form.accountId || accounts[0]?.id,
        startDate: todayISO(),
        endDate: form.endDate || null
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      await load();
      // Criar uma conta fixa já pode gerar o lançamento deste mês; quem mostra a
      // lista/saldo precisa recarregar pra não exibir número velho.
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar a conta fixa.');
    } finally {
      setSaving(false);
    }
  }

  async function acceptSuggestion(suggestion) {
    setBusySuggestion(suggestion.signature);
    try {
      await api.post('/recurrences/suggestions/accept', { signature: suggestion.signature });
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui cadastrar essa conta fixa.');
    } finally {
      setBusySuggestion('');
    }
  }

  async function dismissSuggestion(suggestion) {
    // Some da tela na hora; o backend guarda a dispensa pra nunca mais oferecer.
    setSuggestions((prev) => prev.filter((s) => s.signature !== suggestion.signature));
    await api.post('/recurrences/suggestions/dismiss', { signature: suggestion.signature });
  }

  async function toggleActive(rule) {
    await api.patch(`/recurrences/${rule.id}`, { active: !rule.active });
    await load();
    if (onChanged) onChanged();
  }

  async function remove(rule) {
    if (!window.confirm(
      `Remover a conta fixa "${rule.description}"?\n\nOs lançamentos que ela já gerou continuam no histórico.`
    )) return;
    await api.delete(`/recurrences/${rule.id}`);
    await load();
  }

  const money = (value) => (privateMode ? '••••' : formatMoney(value));
  const monthlyTotal = rules
    .filter((r) => r.active)
    .reduce((sum, r) => sum + (r.type === 'expense' ? r.amount : -r.amount), 0);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="h2">Contas fixas</h2>
          {ready && rules.some((r) => r.active) && (
            <span className="row-sub">
              {money(Math.abs(monthlyTotal))} {monthlyTotal >= 0 ? 'saem' : 'entram'} todo mês, no automático
            </span>
          )}
        </div>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <span aria-hidden="true">+</span> Nova conta fixa
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={handleCreate}
          className="card-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 14, borderBottom: '1px solid var(--line)' }}
        >
          {error && (
            <div className="alert alert-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="toggle" role="group" aria-label="Tipo da conta fixa">
            <button type="button" aria-pressed={form.type === 'expense'} onClick={() => field('type', 'expense')}>
              ↓ Despesa
            </button>
            <button type="button" aria-pressed={form.type === 'income'} onClick={() => field('type', 'income')}>
              ↑ Receita
            </button>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="rec-desc">Descrição</label>
              <input
                id="rec-desc"
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
                placeholder="Aluguel, Netflix, salário…"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rec-amount">Valor</label>
              <input
                id="rec-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => field('amount', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rec-day">Dia do mês</label>
              <input
                id="rec-day"
                type="number"
                min="1"
                max="31"
                inputMode="numeric"
                value={form.dayOfMonth}
                onChange={(e) => field('dayOfMonth', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rec-category">Categoria</label>
              <select id="rec-category" value={form.category} onChange={(e) => field('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {accounts.length > 1 && (
              <div className="field">
                <label htmlFor="rec-account">Conta</label>
                <select id="rec-account" value={form.accountId} onChange={(e) => field('accountId', e.target.value)}>
                  <option value="">{accounts[0]?.name} (padrão)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="rec-end">Até quando (opcional)</label>
              <input
                id="rec-end"
                type="date"
                value={form.endDate}
                onChange={(e) => field('endDate', e.target.value)}
              />
            </div>
          </div>

          <p className="row-sub" style={{ margin: 0 }}>
            Escolhido o dia 31, meses mais curtos cobram no último dia.
          </p>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar conta fixa'}
            </button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(''); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Com o formulário fechado, o erro (ex: falha ao aceitar sugestão) não
          teria onde aparecer — o alerta do form só existe com ele aberto. */}
      {error && !open && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="card-body" style={{ borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span className="row-title">Isso parece fixo</span>
              <div className="row-sub">
                Vi esse padrão se repetindo no seu histórico. Cadastrar deixa o lançamento automático.
              </div>
            </div>

            {suggestions.map((s) => (
              <div
                key={s.signature}
                className="page-head"
                style={{
                  gap: 10,
                  background: 'var(--brand-wash)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  padding: '11px 13px'
                }}
              >
                <div className="row-main">
                  <span className="row-title">{s.label}</span>
                  <span className="row-sub">
                    {money(s.typicalAmount)} · {s.type === 'income' ? 'entra' : 'sai'} por volta do dia{' '}
                    {s.typicalDay} · visto em {s.occurrences} meses
                  </span>
                </div>
                <div className="form-actions" style={{ flexWrap: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => acceptSuggestion(s)}
                    disabled={busySuggestion !== ''}
                  >
                    {busySuggestion === s.signature ? 'Cadastrando…' : 'Cadastrar'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => dismissSuggestion(s)}
                    disabled={busySuggestion !== ''}
                  >
                    Agora não
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!ready ? (
        // Antes da primeira carga, skeleton — não o vazio "nenhuma conta fixa",
        // que seria mentira enquanto os dados não chegaram.
        <div className="rows" aria-hidden="true">
          {[0, 1].map((i) => (
            <div className="row" key={i}>
              <div className="row-main">
                <span className="skeleton skeleton-line" style={{ width: 140 }} />
                <span className="skeleton skeleton-line" style={{ width: 90, height: 10 }} />
              </div>
              <span className="skeleton skeleton-line" style={{ width: 70 }} />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">🔁</div>
          Nenhuma conta fixa. Cadastre o que se repete todo mês — aluguel, assinaturas, salário — e o
          lançamento passa a nascer sozinho na data certa.
        </div>
      ) : (
        <div className="rows">
          {rules.map((rule) => (
            <div className="row" key={rule.id}>
              <div className="row-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span className="row-title">{rule.description}</span>
                  {/* tipo com ícone + rótulo; pausada nunca depende só de cor */}
                  <span className={`pill ${rule.type === 'income' ? 'pill-income' : 'pill-expense'}`}>
                    <span aria-hidden="true">{rule.type === 'income' ? '↑' : '↓'}</span>
                    {rule.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                  {!rule.active && (
                    <span className="pill pill-transfer">
                      <span aria-hidden="true">❙❙</span> Pausada
                    </span>
                  )}
                </div>
                <span className="row-sub">
                  {rule.category} · todo dia {rule.dayOfMonth}
                  {rule.active ? ` · ${dueLabel(rule.nextDue)}` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="row-value">{money(rule.amount)}</span>
                <button
                  type="button"
                  className="icon-btn-sm"
                  onClick={() => toggleActive(rule)}
                  title={rule.active ? 'Pausar' : 'Retomar'}
                  aria-label={`${rule.active ? 'Pausar' : 'Retomar'} a conta fixa ${rule.description}`}
                >
                  {rule.active ? '❙❙' : '▶'}
                </button>
                <button
                  type="button"
                  className="icon-btn-sm"
                  onClick={() => remove(rule)}
                  title="Remover"
                  aria-label={`Remover a conta fixa ${rule.description}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

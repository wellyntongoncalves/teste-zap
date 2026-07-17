import React, { useEffect, useState } from 'react';
import api from '../../api';

// Vincula o número de WhatsApp do usuário à conta. O webhook casa a mensagem
// recebida (From da Twilio) com este número, então sem ele o bot não sabe de
// quem é o gasto. Guardar em E.164: +55 DDD número.
export default function WhatsAppNumber() {
  const [number, setNumber] = useState('');
  const [saved, setSaved] = useState('');
  const [status, setStatus] = useState(''); // '', 'ok', 'error'
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/users/me')
      .then(({ data }) => {
        setNumber(data.whatsappNumber || '');
        setSaved(data.whatsappNumber || '');
      })
      .catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus('');
    setMessage('');
    try {
      const { data } = await api.patch('/users/me', { whatsappNumber: number });
      setNumber(data.whatsappNumber || '');
      setSaved(data.whatsappNumber || '');
      setStatus('ok');
      setMessage(data.whatsappNumber ? 'Número salvo. Já pode mandar seus gastos no WhatsApp.' : 'Número removido.');
    } catch (err) {
      setStatus('error');
      // Número único: se já estiver em outra conta, a API devolve 400.
      setMessage(err.response?.data?.error || 'Não consegui salvar o número. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  const changed = number.trim() !== saved;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">WhatsApp</h2>
        {saved && (
          <span className="pill pill-income">
            <span aria-hidden="true">✓</span> Vinculado
          </span>
        )}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Cadastre seu número para lançar gastos por mensagem — ex: “gastei 50 no mercado”.
          Use o formato internacional, com +55 e DDD.
        </p>

        {status && (
          <div className={`alert ${status === 'ok' ? 'alert-ok' : 'alert-error'}`} role="alert">
            <span aria-hidden="true">{status === 'ok' ? '✓' : '⚠'}</span>
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="form-actions">
          <input
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="+55 11 99999-9999"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            aria-label="Número de WhatsApp"
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="submit" className="btn btn-primary" disabled={saving || !changed}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </section>
  );
}

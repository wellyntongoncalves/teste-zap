import React, { useEffect, useRef, useState } from 'react';
import api from '../../api';

const SUGGESTIONS = [
  'Quanto gastei esse mês?',
  'Qual categoria mais pesou?',
  'Estou estourando algum orçamento?'
];

export default function VeroChat() {
  const [enabled, setEnabled] = useState(null); // null = ainda checando
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api
      .get('/assistant/status')
      .then(({ data }) => setEnabled(data.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, asking]);

  async function send(text) {
    const asked = text.trim();
    if (!asked || asking) return;

    setMessages((prev) => [...prev, { role: 'user', text: asked }]);
    setQuestion('');
    setAsking(true);

    try {
      const { data } = await api.post('/assistant', { question: asked });
      setMessages((prev) => [...prev, { role: 'vero', text: data.answer }]);
    } catch (err) {
      // A API já traduz cada falha num status e numa mensagem em português;
      // mostrar isso é melhor que um "erro" genérico.
      setMessages((prev) => [
        ...prev,
        {
          role: 'vero',
          text: err.response?.data?.error || 'Não consegui responder agora. Tente de novo.',
          isError: true
        }
      ]);
    } finally {
      setAsking(false);
    }
  }

  // Enquanto não sabemos, não mostramos nada — melhor que piscar um card que some.
  if (enabled === null) return null;

  if (!enabled) {
    return (
      <section className="card">
        <div className="card-head">
          <h2 className="h2">Vero</h2>
          <span className="pill pill-transfer">
            <span aria-hidden="true">○</span> Desligado
          </span>
        </div>
        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            O assistente precisa de uma chave da API configurada no servidor. O resto do app funciona normalmente.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Vero</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>Pergunte sobre suas finanças</span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 ? (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble-${m.role} ${m.isError ? 'is-error' : ''}`}>
                {m.text}
              </div>
            ))}
            {asking && (
              <div className="bubble bubble-vero muted">
                <span className="dots" aria-label="Vero está pensando">
                  <i /><i /><i />
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form
          className="form-actions"
          onSubmit={(e) => {
            e.preventDefault();
            send(question);
          }}
        >
          <input
            className="input"
            placeholder="Ex: quanto gastei com mercado esse mês?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="submit" className="btn btn-primary" disabled={asking || !question.trim()}>
            {asking ? 'Pensando…' : 'Perguntar'}
          </button>
        </form>
      </div>
    </section>
  );
}

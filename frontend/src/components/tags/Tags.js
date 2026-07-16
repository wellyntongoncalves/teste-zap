import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function Tags() {
  const [tags, setTags] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    const { data } = await api.get('/tags');
    setTags(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/tags', { name });
      setName('');
      loadTags();
    } catch (err) {
      setError(err.response?.data?.error || 'Não consegui criar a tag.');
    }
  }

  async function handleDelete(tag) {
    if (!window.confirm(`Remover a tag "${tag.name}"? Ela sai dos lançamentos que a usam.`)) return;
    await api.delete(`/tags/${tag.id}`);
    loadTags();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h2">Tags</h2>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div className="alert alert-error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="form-actions">
          <input
            className="input"
            placeholder="Nova tag — ex: viagem"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
            required
          />
          <button type="submit" className="btn btn-primary">Adicionar</button>
        </form>

        {tags.length === 0 ? (
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Nenhuma tag ainda. Tags marcam lançamentos por assunto (viagem, obra) e podem virar orçamento.
          </p>
        ) : (
          <div className="chips">
            {tags.map((tag) => (
              <span key={tag.id} className="chip" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleDelete(tag)}
                  title={`Remover ${tag.name}`}
                  aria-label={`Remover ${tag.name}`}
                  style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12, opacity: 0.7 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

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
      setError(err.response?.data?.error || 'Falha ao criar tag');
    }
  }

  async function handleDelete(id) {
    await api.delete(`/tags/${id}`);
    loadTags();
  }

  return (
    <div>
      <h3>Tags</h3>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Nova tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 6 }}
          required
        />
        <button type="submit">Adicionar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tags.map((tag) => (
          <li key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>{tag.name}</span>
            <button onClick={() => handleDelete(tag.id)}>Remover</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

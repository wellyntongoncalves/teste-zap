import React from 'react';
import Accounts from '../components/accounts/Accounts';
import Tags from '../components/tags/Tags';

export default function Settings({ onLogout }) {
  return (
    <div>
      <h2>Configurações</h2>
      <button onClick={onLogout} style={{ marginBottom: 24 }}>Sair</button>

      <section style={{ marginBottom: 32 }}>
        <Accounts />
      </section>
      <section>
        <Tags />
      </section>
    </div>
  );
}

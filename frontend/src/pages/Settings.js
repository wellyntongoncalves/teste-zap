import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';
import Accounts from '../components/accounts/Accounts';
import Tags from '../components/tags/Tags';
import WhatsAppNumber from '../components/settings/WhatsAppNumber';

export default function Settings({ onLogout }) {
  const { user, privateMode } = useOutletContext();
  const [veroEnabled, setVeroEnabled] = useState(null);

  useEffect(() => {
    // Se o Vero estiver desligado (sem chave), dizemos isso em vez de deixar o
    // usuário achar que o recurso sumiu.
    api
      .get('/assistant/status')
      .then(({ data }) => setVeroEnabled(data.enabled))
      .catch(() => setVeroEnabled(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="h1">Configurações</h1>
        <span className="muted" style={{ fontSize: 13 }}>Contas, tags e sua sessão</span>
      </div>

      <Accounts privateMode={privateMode} />
      <Tags />
      <WhatsAppNumber />

      <section className="card">
        <div className="card-head">
          <h2 className="h2">Vero — assistente</h2>
          {veroEnabled !== null && (
            <span className={veroEnabled ? 'pill pill-income' : 'pill pill-transfer'}>
              <span aria-hidden="true">{veroEnabled ? '✓' : '○'}</span>
              {veroEnabled ? 'Ativo' : 'Desligado'}
            </span>
          )}
        </div>
        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {veroEnabled
              ? 'O Vero está configurado e pode responder perguntas sobre suas finanças.'
              : 'O Vero precisa de uma ANTHROPIC_API_KEY no servidor para funcionar. Enquanto isso, o resto do app segue normal.'}
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h2">Sessão</h2>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div className="row-main">
            <span className="row-title">{user?.name}</span>
            <span className="row-sub">{user?.email}</span>
          </div>
          <button className="btn" onClick={onLogout}>Sair</button>
        </div>
      </section>
    </div>
  );
}

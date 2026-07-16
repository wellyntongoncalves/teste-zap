import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Goals from '../components/goals/Goals';

export default function GoalsPage() {
  const { privateMode } = useOutletContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="h1">Metas</h1>
        <span className="muted" style={{ fontSize: 13 }}>O que você está juntando e quanto falta</span>
      </div>

      <Goals privateMode={privateMode} />
    </div>
  );
}

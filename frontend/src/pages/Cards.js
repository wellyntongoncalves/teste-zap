import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CreditCards from '../components/creditCards/CreditCards';
import Budgets from '../components/budgets/Budgets';

export default function Cards() {
  const { privateMode } = useOutletContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="h1">Cartões e orçamentos</h1>
        <span className="muted" style={{ fontSize: 13 }}>Seus limites e o quanto já foi de cada teto</span>
      </div>

      <CreditCards privateMode={privateMode} />
      <Budgets privateMode={privateMode} />
    </div>
  );
}

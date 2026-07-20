import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CreditCards from '../components/creditCards/CreditCards';
import Budgets from '../components/budgets/Budgets';
import Recurrences from '../components/recurrences/Recurrences';

export default function Cards() {
  const { privateMode } = useOutletContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="h1">Planejamento</h1>
        <span className="muted" style={{ fontSize: 13 }}>
          Seus cartões, os tetos de cada categoria e o que se repete todo mês
        </span>
      </div>

      <CreditCards privateMode={privateMode} />
      <Recurrences privateMode={privateMode} />
      <Budgets privateMode={privateMode} />
    </div>
  );
}

import React from 'react';
import CreditCards from '../components/creditCards/CreditCards';
import Budgets from '../components/budgets/Budgets';

export default function Cards() {
  return (
    <div>
      <h2>Cartões e orçamentos</h2>
      <section style={{ marginBottom: 32 }}>
        <CreditCards />
      </section>
      <section>
        <Budgets />
      </section>
    </div>
  );
}

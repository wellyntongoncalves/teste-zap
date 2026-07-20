import React from 'react';

// Símbolo da marca (brandbook do dono): escudo com o "M" dentro — proteção do
// dinheiro, não mais a carteira antiga. SVG inline pra ficar nítido em qualquer
// tamanho e herdar a cor do contexto (.brand-badge pinta com --brand).
export default function BrandMark({ className = '' }) {
  return (
    <span className={`brand-badge ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5 4 5.6v6.1c0 4.7 3.2 8.4 8 9.8 4.8-1.4 8-5.1 8-9.8V5.6L12 2.5Z" />
        <path d="M8.4 15.6V9.6l3.6 3.5 3.6-3.5v6" />
      </svg>
    </span>
  );
}

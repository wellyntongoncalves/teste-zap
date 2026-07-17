import React from 'react';

// Símbolo da marca: uma carteira (o "bolso" do MeuBolso), desenhada como SVG
// inline pra ficar nítida em qualquer tamanho e herdar a cor do contexto.
// O tamanho vem do CSS de .brand-badge (26px no appbar, 32px no login).
export default function BrandMark({ className = '' }) {
  return (
    <span className={`brand-badge ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 8V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-1" />
        <path d="M22 9.5h-4.5a2.5 2.5 0 0 0 0 5H22a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" />
      </svg>
    </span>
  );
}

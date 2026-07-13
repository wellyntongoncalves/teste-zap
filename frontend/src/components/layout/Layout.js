import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/cartoes', label: 'Cartões' },
  { to: '/metas', label: 'Metas' }
];

export default function Layout({ user }) {
  return (
    <div style={{ fontFamily: 'sans-serif', paddingBottom: 72, minHeight: '100vh', boxSizing: 'border-box' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #eee'
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Finanças</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Olá, {user.name}</span>
          <Link to="/configuracoes" aria-label="Configurações" style={{ fontSize: 20, textDecoration: 'none' }}>
            ⚙️
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </main>

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-around',
          background: '#fff',
          borderTop: '1px solid #eee',
          padding: '10px 0'
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              textDecoration: 'none',
              color: isActive ? '#2f5c8a' : '#666',
              fontWeight: isActive ? 'bold' : 'normal',
              fontSize: 14
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

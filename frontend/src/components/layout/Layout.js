import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true, icon: <path d="M3 10.5L12 3l9 7.5M5.5 9.5V20h13V9.5" /> },
  { to: '/lancamentos', label: 'Lançamentos', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  {
    to: '/cartoes',
    label: 'Cartões',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10.5h18" />
      </>
    )
  },
  {
    to: '/metas',
    label: 'Metas',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    )
  }
];

// 'system' não grava nada e deixa a media query do SO decidir; light/dark
// carimbam data-theme, que precisa ganhar da media query nos dois sentidos.
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mb_theme') || 'system');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('mb_theme');
    } else {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('mb_theme', theme);
    }
  }, [theme]);

  return [theme, setTheme];
}

export default function Layout({ user }) {
  const [theme, setTheme] = useTheme();
  const [privateMode, setPrivateMode] = useState(() => localStorage.getItem('mb_private') === '1');

  useEffect(() => {
    localStorage.setItem('mb_private', privateMode ? '1' : '0');
  }, [privateMode]);

  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-inner">
          <div className="brand-mark">
            <span className="brand-badge" aria-hidden="true">M</span>
            MeuBolso
          </div>

          <div className="appbar-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPrivateMode((v) => !v)}
              aria-pressed={privateMode}
              title={privateMode ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {privateMode ? '🙈' : '👁️'}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Tema claro' : 'Tema escuro'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <Link to="/configuracoes" className="icon-btn" aria-label="Configurações">
              ⚙️
            </Link>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet context={{ user, privateMode }} />
      </main>

      <nav className="tabbar" aria-label="Navegação principal">
        <div className="tabbar-inner">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

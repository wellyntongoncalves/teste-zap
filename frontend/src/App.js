import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Cards from './pages/Cards';
import GoalsPage from './pages/GoalsPage';
import Settings from './pages/Settings';
import api, { clearSession } from './api';

function loadStoredUser() {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  if (!token || !stored) return null;

  try {
    return JSON.parse(stored);
  } catch (err) {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(loadStoredUser);

  useEffect(() => {
    const handleForcedLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  async function handleLogout() {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      // mesmo se a revogação falhar, seguimos limpando a sessão local
    }
    clearSession();
    setUser(null);
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} />}>
          <Route path="/" element={<Home />} />
          <Route path="/lancamentos" element={<Transactions />} />
          <Route path="/cartoes" element={<Cards />} />
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/configuracoes" element={<Settings onLogout={handleLogout} />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

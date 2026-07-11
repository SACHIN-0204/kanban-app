import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'kanban_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // On load, if we have a stored token, verify it's still valid and fetch the user
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        // Token expired or invalid - clear it
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function saveSession(user, token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    setToken(token);
    setUser(user);
  }

  async function signup(name, email, password) {
    const { user, token } = await api.signup(name, email, password);
    saveSession(user, token);
  }

  async function login(email, password) {
    const { user, token } = await api.login(email, password);
    saveSession(user, token);
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

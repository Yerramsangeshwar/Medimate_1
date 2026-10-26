import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, hasToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!hasToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
  };

  const loginDemo = async () => {
    const { token, user } = await api.loginDemo();
    setToken(token);
    setUser(user);
  };

  const register = async (payload) => {
    const { token, user } = await api.register(payload);
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const { user } = await api.me();
    setUser(user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginDemo, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

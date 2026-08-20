import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, loadToken, setToken, type AuthResponse } from "../lib/api";

interface AuthState {
  user: AuthResponse["user"] | null;
  workspace: AuthResponse["workspace"] | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [workspace, setWorkspace] = useState<AuthResponse["workspace"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        setUser(res.user);
        setWorkspace(res.workspace);
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
    setWorkspace(res.workspace);
  }

  async function register(email: string, password: string, name?: string) {
    const res = await api.register(email, password, name);
    await setToken(res.token);
    setUser(res.user);
    setWorkspace(res.workspace);
  }

  function logout() {
    clearToken();
    setUser(null);
    setWorkspace(null);
  }

  return (
    <AuthContext.Provider value={{ user, workspace, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

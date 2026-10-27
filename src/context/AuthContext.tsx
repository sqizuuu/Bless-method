import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, PointsStatus } from '../types.js';
import { api, getStoredToken, setStoredToken } from '../api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  pointsStatus: PointsStatus | null;
  refreshUser: () => Promise<void>;
  refreshPoints: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'discord') => Promise<void>;
  simulateOAuth: (provider: 'google' | 'discord') => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pointsStatus, setPointsStatus] = useState<PointsStatus | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const refreshPoints = useCallback(async () => {
    try {
      if (getStoredToken()) {
        const status = await api.getPointsStatus();
        setPointsStatus(status);
        if (user && status.balance !== user.pointsBalance) {
          setUser((prev) => (prev ? { ...prev, pointsBalance: status.balance } : null));
        }
      }
    } catch {
      // ignore
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      await refreshPoints();
    } catch {
      console.warn('Session expired, clearing token');
      api.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshPoints]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for OAuth postMessage events from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin is from preview run.app or localhost
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, user: oauthUser } = event.data;
        if (token && oauthUser) {
          setStoredToken(token);
          setUser(oauthUser);
          await refreshPoints();
          setIsAuthModalOpen(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshPoints]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    await refreshPoints();
    setIsAuthModalOpen(false);
  };

  const register = async (email: string, pass: string, name?: string) => {
    const res = await api.register(email, pass, name);
    setUser(res.user);
    await refreshPoints();
    setIsAuthModalOpen(false);
  };

  const loginWithOAuth = async (provider: 'google' | 'discord') => {
    try {
      const { url, needsConfig } = await api.getOAuthUrl(provider);

      if (needsConfig || !url) {
        // Fall back to sandbox simulation if credentials aren't set
        await simulateOAuth(provider);
        return;
      }

      // Open OAuth provider directly in popup window per oauth-integration guidelines
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        `oauth_${provider}_popup`,
        `width=${width},height=${height},top=${top},left=${left}`
      );

      if (!authWindow) {
        alert('Popup blocked. Please allow popups for this site to sign in with ' + provider);
      }
    } catch {
      // If error (e.g. unconfigured keys), fall back to sandbox test simulation
      await simulateOAuth(provider);
    }
  };

  const simulateOAuth = async (provider: 'google' | 'discord') => {
    const res = await api.simulateOAuthLogin(provider);
    setUser(res.user);
    await refreshPoints();
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setPointsStatus(null);
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pointsStatus,
        refreshUser,
        refreshPoints,
        login,
        register,
        loginWithOAuth,
        simulateOAuth,
        logout,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

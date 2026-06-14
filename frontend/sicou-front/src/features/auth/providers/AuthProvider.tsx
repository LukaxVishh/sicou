import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentUser, login } from '../api';
import {
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  isStoredSessionExpired,
  saveAuthSession,
} from '../lib';
import type { AuthUser, LoginRequest } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (request: LoginRequest) => Promise<void>;
  signOut: () => void;
  refreshCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(() => {
    clearAuthSession();
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const currentUser = await getCurrentUser();

    setUser(currentUser);
  }, []);

  const signIn = useCallback(async (request: LoginRequest) => {
    const response = await login(request);

    saveAuthSession(response);
    setUser(response.user);
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        const token = getStoredToken();

        if (!token || isStoredSessionExpired()) {
          signOut();
          return;
        }

        const currentUser = await getCurrentUser();

        setUser(currentUser);
      } catch {
        signOut();
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [signOut]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      signIn,
      signOut,
      refreshCurrentUser,
    };
  }, [user, isLoading, signIn, signOut, refreshCurrentUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
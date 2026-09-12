import { createContext } from 'react';
import type { AuthUser, LoginRequest } from '../types';

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (request: LoginRequest) => Promise<void>;
  signOut: () => void;
  refreshCurrentUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
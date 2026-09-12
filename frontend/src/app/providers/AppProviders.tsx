import type { ReactNode } from 'react';
import { AuthProvider } from '../../features/auth/providers';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
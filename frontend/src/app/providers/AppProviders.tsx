import type { ReactNode } from 'react';
import { AuthProvider } from '../../features/auth/providers';
import { SystemDialogProvider, SystemFormValidationProvider } from '../../shared/components';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SystemDialogProvider>
      <SystemFormValidationProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </SystemFormValidationProvider>
    </SystemDialogProvider>
  );
}

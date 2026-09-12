import type { SystemRole } from '../../../shared/constants/roles';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId?: string | null;
  unitId?: string | null;
  roles: SystemRole[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
};
export type UserRole =
  | 'SUPER_ADMIN'
  | 'DEVELOPER'
  | 'COMPANY_ADMIN'
  | 'AREA_ADMIN'
  | 'HEADQUARTER_USER'
  | 'UNIT_USER';

export type User = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId: string | null;
  unitId: string | null;
  companyName?: string | null;
  unitName?: string | null;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string | null;
};

export type CreateUserRequest = {
  fullName: string;
  email: string;
  password: string;
  companyId: string | null;
  unitId: string | null;
  roles: UserRole[];
};

export type UpdateUserRequest = {
  fullName: string;
  email: string;
  companyId: string | null;
  unitId: string | null;
  isActive: boolean;
  /** RF-010: na troca de unidade dentro da mesma empresa, recria os acessos de setor na nova unidade. */
  copyAccessesToNewUnit?: boolean;
};

/** Registro de transferência de unidade/empresa (RF-010). */
export type UserTransfer = {
  id: string;
  createdAt: string;
  fromCompanyName: string | null;
  fromUnitName: string;
  toCompanyName: string | null;
  toUnitName: string;
  performedByName: string;
  copyAccessesRequested: boolean;
  revokedAreaAccesses: number;
  copiedAreaAccesses: number;
  revokedProcessNodes: number;
};

export type UpdateUserRolesRequest = {
  roles: UserRole[];
};
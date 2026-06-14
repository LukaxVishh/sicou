export type UserRole =
  | 'SUPER_ADMIN'
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
};

export type UpdateUserRolesRequest = {
  roles: UserRole[];
};
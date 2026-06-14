export const SystemRoles = {
  SuperAdmin: 'SUPER_ADMIN',
  CompanyAdmin: 'COMPANY_ADMIN',
  AreaAdmin: 'AREA_ADMIN',
  HeadquarterUser: 'HEADQUARTER_USER',
  UnitUser: 'UNIT_USER',
} as const;

export type SystemRole = typeof SystemRoles[keyof typeof SystemRoles];
export const SystemRoles = {
  SuperAdmin: 'SUPER_ADMIN',
  /** Perfil Desenvolvedor (RF-004): mesmos poderes do Super Admin, identificado separadamente. */
  Developer: 'DEVELOPER',
  CompanyAdmin: 'COMPANY_ADMIN',
  AreaAdmin: 'AREA_ADMIN',
  HeadquarterUser: 'HEADQUARTER_USER',
  UnitUser: 'UNIT_USER',
} as const;

export type SystemRole = typeof SystemRoles[keyof typeof SystemRoles];

export const platformAdminRoles: readonly string[] = [SystemRoles.SuperAdmin, SystemRoles.Developer];

/** Super Admin ou Desenvolvedor: administradores da plataforma. */
export function isPlatformAdmin(roles?: readonly string[] | null): boolean {
  return roles?.some((role) => platformAdminRoles.includes(role)) ?? false;
}

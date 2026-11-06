namespace Sicou.Domain.Constants;

public static class SystemRoles
{
    public const string SuperAdmin = "SUPER_ADMIN";

    /// <summary>Perfil Desenvolvedor (RF-004): mesmos poderes do Super Admin, identificado separadamente.</summary>
    public const string Developer = "DEVELOPER";

    public const string CompanyAdmin = "COMPANY_ADMIN";

    public const string AreaAdmin = "AREA_ADMIN";

    public const string HeadquarterUser = "HEADQUARTER_USER";

    public const string UnitUser = "UNIT_USER";

    /// <summary>Perfis com acesso de administrador da plataforma, no formato de <c>[Authorize(Roles = ...)]</c>.</summary>
    public const string PlatformAdmins = SuperAdmin + "," + Developer;

    public static readonly string[] PlatformAdminRoles = [SuperAdmin, Developer];

    public static readonly string[] All =
    [
        SuperAdmin,
        Developer,
        CompanyAdmin,
        AreaAdmin,
        HeadquarterUser,
        UnitUser
    ];

    /// <summary>Verdadeiro para Super Admin ou Desenvolvedor.</summary>
    public static bool IsPlatformAdmin(IEnumerable<string> roles) => roles.Any(r => r is SuperAdmin or Developer);
}

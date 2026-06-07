namespace Sicou.Domain.Constants;

public static class SystemRoles
{
    public const string SuperAdmin = "SUPER_ADMIN";

    public const string CompanyAdmin = "COMPANY_ADMIN";

    public const string AreaAdmin = "AREA_ADMIN";

    public const string HeadquarterUser = "HEADQUARTER_USER";

    public const string UnitUser = "UNIT_USER";

    public static readonly string[] All =
    [
        SuperAdmin,
        CompanyAdmin,
        AreaAdmin,
        HeadquarterUser,
        UnitUser
    ];
}
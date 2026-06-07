using Microsoft.AspNetCore.Authorization;

namespace Sicou.Infrastructure.Authorization;

public class AreaPermissionRequirement : IAuthorizationRequirement
{
    public string PermissionName { get; }

    public AreaPermissionRequirement(string permissionName)
    {
        PermissionName = permissionName;
    }
}
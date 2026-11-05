using Microsoft.AspNetCore.Identity;
using Sicou.Domain.Constants;

namespace Sicou.Infrastructure.Identity;

public static class UserManagerRoleExtensions
{
    /// <summary>Super Admin ou Desenvolvedor (RF-004), que têm os mesmos poderes na plataforma.</summary>
    public static async Task<bool> IsPlatformAdminAsync(this UserManager<ApplicationUser> users, ApplicationUser user)
        => SystemRoles.IsPlatformAdmin(await users.GetRolesAsync(user));
}

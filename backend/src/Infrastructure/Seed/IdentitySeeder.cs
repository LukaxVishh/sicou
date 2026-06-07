using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Seed;

public static class IdentitySeeder
{
    public static async Task SeedRolesAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

        foreach (var roleName in SystemRoles.All)
        {
            var exists = await roleManager.RoleExistsAsync(roleName);

            if (exists)
                continue;

            var role = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = roleName,
                NormalizedName = roleName.ToUpperInvariant(),
                Description = GetRoleDescription(roleName),
                IsSystemRole = true,
                CreatedAt = DateTime.UtcNow
            };

            var result = await roleManager.CreateAsync(role);

            if (!result.Succeeded)
            {
                var errors = string.Join(" | ", result.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Erro ao criar role {roleName}: {errors}");
            }
        }
    }

    private static string GetRoleDescription(string roleName)
    {
        return roleName switch
        {
            SystemRoles.SuperAdmin => "Administrador geral do sistema.",
            SystemRoles.CompanyAdmin => "Administrador da empresa.",
            SystemRoles.AreaAdmin => "Administrador de área da sede.",
            SystemRoles.HeadquarterUser => "Usuário operacional da sede.",
            SystemRoles.UnitUser => "Usuário operacional da unidade.",
            _ => "Perfil do sistema."
        };
    }
}
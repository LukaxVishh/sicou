using Sicou.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Infrastructure.Services;
using Sicou.Infrastructure.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Sicou.Infrastructure.Authorization;
using Microsoft.Extensions.Configuration;
using Sicou.Application.Interfaces.Services;
using Microsoft.Extensions.DependencyInjection;
using Sicou.Application.Interfaces.Repositories;


namespace Sicou.Infrastructure.Extensions;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services
            .AddIdentity<ApplicationUser, ApplicationRole>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;

                options.User.RequireUniqueEmail = true;

                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        
        services.AddHttpContextAccessor();

        services.AddScoped<IUnitRepository, UnitRepository>();
        services.AddScoped<IAreaRepository, AreaRepository>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<IUserAreaAccessRepository, UserAreaAccessRepository>();

        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUnitService, UnitService>();
        services.AddScoped<IAreaService, AreaService>();
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IUserAreaAccessService, UserAreaAccessService>();

        services.AddScoped<IAuthorizationHandler, AreaPermissionHandler>();


        return services;
    }
}
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Data;

public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
{
    public DbSet<Company> Companies => Set<Company>();

    public DbSet<Unit> Units => Set<Unit>();

    public DbSet<Area> Areas => Set<Area>();

    public DbSet<Sicou.Domain.Entities.Module> Modules
        => Set<Sicou.Domain.Entities.Module>();

    public DbSet<AreaModule> AreaModules => Set<AreaModule>();

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        ConfigureIdentityTables(builder);
        ConfigureDomainTables(builder);
        SeedModules(builder);
    }

    private static void ConfigureIdentityTables(ModelBuilder builder)
    {
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("users");

            entity.Property(x => x.FullName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.CompanyId);

            entity.Property(x => x.UnitId);
        });

        builder.Entity<ApplicationRole>(entity =>
        {
            entity.ToTable("roles");

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.IsSystemRole)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .IsRequired();
        });

        builder.Entity<IdentityUserRole<Guid>>()
            .ToTable("user_roles");

        builder.Entity<IdentityUserClaim<Guid>>()
            .ToTable("user_claims");

        builder.Entity<IdentityUserLogin<Guid>>()
            .ToTable("user_logins");

        builder.Entity<IdentityRoleClaim<Guid>>()
            .ToTable("role_claims");

        builder.Entity<IdentityUserToken<Guid>>()
            .ToTable("user_tokens");
    }

    private static void ConfigureDomainTables(ModelBuilder builder)
    {
        builder.Entity<Company>(entity =>
        {
            entity.ToTable("companies");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Document)
                .HasMaxLength(50);

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.HasMany(x => x.Units)
                .WithOne(x => x.Company)
                .HasForeignKey(x => x.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(x => x.Areas)
                .WithOne(x => x.Company)
                .HasForeignKey(x => x.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Unit>(entity =>
        {
            entity.ToTable("units");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.CompanyId)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Code)
                .HasMaxLength(50);

            entity.Property(x => x.City)
                .HasMaxLength(100);

            entity.Property(x => x.State)
                .HasMaxLength(2);

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.HasIndex(x => new { x.CompanyId, x.Code })
                .IsUnique();
        });

        builder.Entity<Area>(entity =>
        {
            entity.ToTable("areas");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.CompanyId)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Slug)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.HasIndex(x => new { x.CompanyId, x.Slug })
                .IsUnique();
        });

        builder.Entity<Sicou.Domain.Entities.Module>(entity =>
        {
            entity.ToTable("modules");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Code)
                .HasConversion<int>()
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.HasIndex(x => x.Code)
                .IsUnique();
        });

        builder.Entity<AreaModule>(entity =>
        {
            entity.ToTable("area_modules");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.AreaId)
                .IsRequired();

            entity.Property(x => x.ModuleId)
                .IsRequired();

            entity.Property(x => x.Enabled)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .IsRequired();

            entity.Property(x => x.UpdatedAt);

            entity.Property(x => x.IsActive)
                .IsRequired();

            entity.HasOne(x => x.Area)
                .WithMany(x => x.AreaModules)
                .HasForeignKey(x => x.AreaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Module)
                .WithMany(x => x.AreaModules)
                .HasForeignKey(x => x.ModuleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.AreaId, x.ModuleId })
                .IsUnique();
        });
    }

    private static void SeedModules(ModelBuilder builder)
    {
        var createdAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        builder.Entity<Sicou.Domain.Entities.Module>().HasData(
            new Sicou.Domain.Entities.Module
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                Code = ModuleCode.Informatives,
                Name = "Informativos",
                Description = "Módulo para publicação de comunicados, novidades, arquivos e informações da área.",
                CreatedAt = createdAt,
                UpdatedAt = null,
                IsActive = true
            },
            new Sicou.Domain.Entities.Module
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                Code = ModuleCode.Guide,
                Name = "Orientador",
                Description = "Módulo para criação de botões, links, arquivos e orientações rápidas da área.",
                CreatedAt = createdAt,
                UpdatedAt = null,
                IsActive = true
            },
            new Sicou.Domain.Entities.Module
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                Code = ModuleCode.Workflows,
                Name = "Workflows",
                Description = "Módulo para criação e execução de fluxos de atendimento e serviços da área.",
                CreatedAt = createdAt,
                UpdatedAt = null,
                IsActive = true
            }
        );
    }
}
using Microsoft.EntityFrameworkCore;
using Sicou.Infrastructure.Identity;
using Sicou.Infrastructure.Integrations;

namespace Sicou.Infrastructure.Data;

public static class IntegrationModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<IntegrationToken>(e =>
        {
            e.ToTable("integration_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.Property(x => x.SecurityStamp).HasMaxLength(256);
            e.Property(x => x.Scopes).HasMaxLength(500);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<IntegrationCall>(e =>
        {
            e.ToTable("integration_calls");
            e.HasKey(x => x.Id);
            e.Property(x => x.Method).HasMaxLength(10);
            e.Property(x => x.Route).HasMaxLength(300);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.TokenId, x.CreatedAt });
            e.HasOne<IntegrationToken>().WithMany().HasForeignKey(x => x.TokenId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}

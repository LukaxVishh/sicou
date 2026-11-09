using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Data;

internal static class IntegrationModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<IntegrationToken>(e =>
        {
            e.ToTable("integration_tokens");
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).HasMaxLength(100).IsRequired();
            e.Property(t => t.ExternalSystem).HasMaxLength(100).IsRequired();
            e.Property(t => t.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(t => t.TokenPrefix).HasMaxLength(16).IsRequired();
            e.Property(t => t.Scopes).HasMaxLength(500).IsRequired();
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => new { t.CompanyId, t.CreatedAt });
            e.HasOne<Company>().WithMany().HasForeignKey(t => t.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(t => t.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<IntegrationCall>(e =>
        {
            e.ToTable("integration_calls");
            e.HasKey(c => c.Id);
            e.Property(c => c.Method).HasMaxLength(10).IsRequired();
            e.Property(c => c.Route).HasMaxLength(300).IsRequired();
            e.HasOne(c => c.Token).WithMany(t => t.Calls).HasForeignKey(c => c.TokenId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(c => new { c.TokenId, c.CreatedAt });
            e.HasIndex(c => c.CreatedAt);
        });
    }
}

using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Data;

internal static class UserTransferModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<UserTransfer>(e =>
        {
            e.ToTable("user_transfers");
            e.HasKey(t => t.Id);
            e.Property(t => t.FromCompanyName).HasMaxLength(200);
            e.Property(t => t.ToCompanyName).HasMaxLength(200);
            e.Property(t => t.FromUnitName).HasMaxLength(200);
            e.Property(t => t.ToUnitName).HasMaxLength(200);
            e.Property(t => t.PerformedByName).HasMaxLength(200).IsRequired();
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(t => new { t.UserId, t.CreatedAt });
        });
    }
}

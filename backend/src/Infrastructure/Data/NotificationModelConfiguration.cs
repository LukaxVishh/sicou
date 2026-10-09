using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Data;

internal static class NotificationModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<UserNotification>(e =>
        {
            e.ToTable("user_notifications");
            e.HasKey(n => n.Id);
            e.Property(n => n.Audience).HasMaxLength(32).IsRequired();
            e.Property(n => n.Title).HasMaxLength(250).IsRequired();
            e.Property(n => n.Url).HasMaxLength(500).IsRequired();
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(n => new { n.UserId, n.ReadAt, n.CreatedAt });
        });
    }
}

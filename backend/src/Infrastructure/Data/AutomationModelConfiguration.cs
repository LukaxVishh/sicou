using Microsoft.EntityFrameworkCore;
using Sicou.Infrastructure.Automations;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Data;

public static class AutomationModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<Automation>(e =>
        {
            e.ToTable("automations");
            e.HasKey(a => a.Id);
            e.Property(a => a.Name).HasMaxLength(100);
            e.HasIndex(a => new { a.CompanyId, a.UserId, a.CreatedAt });
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<AutomationRun>(e =>
        {
            e.ToTable("automation_runs");
            e.HasKey(r => r.Id);
            e.Property(r => r.Status).HasMaxLength(20);
            e.Property(r => r.Host).HasMaxLength(100);
            e.Property(r => r.Message).HasMaxLength(2000);
            e.Property(r => r.Logs).HasMaxLength(16000);
            e.HasIndex(r => new { r.AutomationId, r.ExternalId }).IsUnique();
            e.HasIndex(r => new { r.AutomationId, r.StartedAt });
            e.HasIndex(r => new { r.Status, r.LastHeartbeatAt });
            e.HasOne<Automation>().WithMany().HasForeignKey(r => r.AutomationId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<AutomationAlert>(e =>
        {
            e.ToTable("automation_alerts");
            e.HasKey(a => a.Id);
            e.Property(a => a.Kind).HasMaxLength(20);
            e.Property(a => a.Message).HasMaxLength(250);
            e.HasIndex(a => new { a.AutomationId, a.CreatedAt });
            e.HasOne<Automation>().WithMany().HasForeignKey(a => a.AutomationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<AutomationRun>().WithMany().HasForeignKey(a => a.RunId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}

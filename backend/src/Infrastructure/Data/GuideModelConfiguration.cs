using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;

namespace Sicou.Infrastructure.Data;

internal static class GuideModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<GuideCategory>(e =>
        {
            e.ToTable("guide_categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.HasIndex(x => new { x.AreaId, x.SortOrder });
            e.HasAlternateKey(x => new { x.Id, x.AreaId });
            e.HasOne<Area>().WithMany().HasForeignKey(x => x.AreaId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<GuideItem>(e =>
        {
            e.ToTable("guide_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Content).HasMaxLength(50000).IsRequired();
            e.Property(x => x.Url).HasMaxLength(2048);
            e.Property(x => x.FileName).HasMaxLength(255);
            e.HasIndex(x => new { x.AreaId, x.IsPublished, x.SortOrder });
            e.HasOne<GuideCategory>().WithMany().HasForeignKey(x => new { x.CategoryId, x.AreaId })
                .HasPrincipalKey(x => new { x.Id, x.AreaId }).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
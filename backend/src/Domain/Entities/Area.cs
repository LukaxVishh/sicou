using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class Area : BaseEntity
{
    public Guid CompanyId { get; set; }

    public Company Company { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ICollection<AreaModule> AreaModules { get; set; } = new List<AreaModule>();
}
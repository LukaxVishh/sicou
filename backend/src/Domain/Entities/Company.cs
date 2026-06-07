using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Document { get; set; }

    public ICollection<Unit> Units { get; set; } = new List<Unit>();

    public ICollection<Area> Areas { get; set; } = new List<Area>();
}
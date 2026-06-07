using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class AreaModule : BaseEntity
{
    public Guid AreaId { get; set; }

    public Area Area { get; set; } = null!;

    public Guid ModuleId { get; set; }

    public Module Module { get; set; } = null!;

    public bool Enabled { get; set; } = true;
}
using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class GuideCategory : BaseEntity
{
    public Guid AreaId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

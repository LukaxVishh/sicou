using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class FieldDefinition : BaseEntity
{
    public Guid AreaId { get; set; }
    public Area Area { get; set; } = null!;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Placeholder { get; set; }

    public FieldType Type { get; set; } = FieldType.Text;
    public string? GlobalOptionsJson { get; set; }
}

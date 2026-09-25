using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class ProcessNode : BaseEntity
{
    public Guid AreaId { get; set; }
    public Area Area { get; set; } = null!;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ProcessNodeType NodeType { get; set; } = ProcessNodeType.StandardStage;
}

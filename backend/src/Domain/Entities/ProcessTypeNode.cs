using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class ProcessTypeNode : BaseEntity
{
    public Guid ProcessTypeId { get; set; }
    public ProcessType ProcessType { get; set; } = null!;

    public Guid ProcessNodeId { get; set; }
    public ProcessNode ProcessNode { get; set; } = null!;

    public int Order { get; set; } = 1;
    public string? Instructions { get; set; }
}

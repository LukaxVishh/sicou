using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class UserProcessNode : BaseEntity
{
    public string UserId { get; set; } = string.Empty;

    public Guid ProcessNodeId { get; set; }
    public ProcessNode ProcessNode { get; set; } = null!;
}

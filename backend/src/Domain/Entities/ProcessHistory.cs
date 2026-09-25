using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class ProcessHistory : BaseEntity
{
    public Guid ProcessInstanceId { get; set; }
    public ProcessInstance ProcessInstance { get; set; } = null!;

    public Guid? FromNodeId { get; set; }
    public ProcessNode? FromNode { get; set; }

    public Guid? ToNodeId { get; set; }
    public ProcessNode? ToNode { get; set; }

    public ProcessActionType Action { get; set; } = ProcessActionType.Advance;

    public string UserId { get; set; } = string.Empty;
    public string? UserFullName { get; set; }

    public string? Observations { get; set; }
}

using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class ProcessType : BaseEntity
{
    public Guid AreaId { get; set; }
    public Area Area { get; set; } = null!;

    public Guid FamilyId { get; set; } = Guid.NewGuid();
    public int VersionNumber { get; set; } = 1;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ProcessAudience TargetAudience { get; set; } = ProcessAudience.All;
    public ProcessTypeStatus Status { get; set; } = ProcessTypeStatus.Draft;

    public Guid? StartNodeId { get; set; }
    public ProcessNode? StartNode { get; set; }

    public ICollection<ProcessTypeNode> Nodes { get; set; } = new List<ProcessTypeNode>();
    public ICollection<ProcessTypeField> Fields { get; set; } = new List<ProcessTypeField>();
    public ICollection<ProcessTransition> Transitions { get; set; } = new List<ProcessTransition>();
}

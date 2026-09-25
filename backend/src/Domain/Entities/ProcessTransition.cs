using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class ProcessTransition : BaseEntity
{
    public Guid ProcessTypeId { get; set; }
    public ProcessType ProcessType { get; set; } = null!;

    public Guid FromNodeId { get; set; }
    public ProcessNode FromNode { get; set; } = null!;

    public Guid ToNodeId { get; set; }
    public ProcessNode ToNode { get; set; } = null!;

    public bool AllowAdvance { get; set; } = true;
    public bool AllowReturn { get; set; } = true;
    public bool AllowRestart { get; set; } = true;
}

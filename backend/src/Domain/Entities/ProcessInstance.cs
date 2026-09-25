using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class ProcessInstance : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;

    public Guid AreaId { get; set; }
    public Area Area { get; set; } = null!;

    public Guid ProcessTypeId { get; set; }
    public ProcessType ProcessType { get; set; } = null!;

    public Guid CurrentNodeId { get; set; }
    public ProcessNode CurrentNode { get; set; } = null!;

    public string ProcessNumber { get; set; } = string.Empty;
    public string? Title { get; set; }

    public ProcessStatus Status { get; set; } = ProcessStatus.InReview;

    public string CreatedByUserId { get; set; } = string.Empty;
    public string? CreatedByUserName { get; set; }

    public Guid? OriginUnitId { get; set; }
    public Unit? OriginUnit { get; set; }

    public ICollection<ProcessFieldValue> FieldValues { get; set; } = new List<ProcessFieldValue>();
    public ICollection<ProcessHistory> History { get; set; } = new List<ProcessHistory>();
}

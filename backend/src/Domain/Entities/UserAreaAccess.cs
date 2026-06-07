using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class UserAreaAccess : BaseEntity
{
    public string UserId { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;

    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    public Guid AreaId { get; set; }
    public Area Area { get; set; } = null!;

    public bool CanView { get; set; } = true;

    public bool CanManage { get; set; } = false;

    public bool CanPublishInformatives { get; set; } = false;

    public bool CanManageGuide { get; set; } = false;

    public bool CanManageWorkflows { get; set; } = false;

    public bool CanHandleWorkflowRequests { get; set; } = false;
}
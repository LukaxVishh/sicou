namespace Sicou.Application.Responses.UserAreaAccesses;

public class UserAreaAccessResponse
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;

    public Guid? UnitId { get; set; }
    public string? UnitName { get; set; }

    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;

    public bool CanView { get; set; }

    public bool CanManage { get; set; }

    public bool CanPublishInformatives { get; set; }

    public bool CanManageGuide { get; set; }

    public bool CanManageWorkflows { get; set; }

    public bool CanHandleWorkflowRequests { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
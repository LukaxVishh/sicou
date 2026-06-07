namespace Sicou.Application.Requests.UserAreaAccesses;

public class CreateUserAreaAccessRequest
{
    public string UserId { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public Guid AreaId { get; set; }

    public bool CanView { get; set; } = true;

    public bool CanManage { get; set; }

    public bool CanPublishInformatives { get; set; }

    public bool CanManageGuide { get; set; }

    public bool CanManageWorkflows { get; set; }

    public bool CanHandleWorkflowRequests { get; set; }
}
namespace Sicou.Application.Requests.UserAreaAccesses;

public class UpdateUserAreaAccessRequest
{
    public bool CanView { get; set; } = true;

    public bool CanManage { get; set; }

    public bool CanPublishInformatives { get; set; }

    public bool CanManageGuide { get; set; }

    public bool CanManageWorkflows { get; set; }

    public bool CanHandleWorkflowRequests { get; set; }
}
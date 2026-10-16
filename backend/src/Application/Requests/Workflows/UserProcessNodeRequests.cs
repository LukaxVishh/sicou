namespace Sicou.Application.Requests.Workflows;

public class AssignUserProcessNodesRequest
{
    public List<Guid> ProcessNodeIds { get; set; } = new();
}

public class AssignProcessNodeUsersRequest
{
    public List<string> UserIds { get; set; } = new();
}

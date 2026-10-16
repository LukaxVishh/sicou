using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Users;
using Sicou.Application.Responses.Workflows;

namespace Sicou.Application.Interfaces.Services;

public interface IUserProcessNodeService
{
    Task<List<ProcessNodeResponse>> GetNodesByUserIdAsync(string userId);
    Task<List<ProcessNodeResponse>> GetMyNodesAsync();
    Task<List<ProcessNodeResponse>> AssignNodesToUserAsync(string userId, AssignUserProcessNodesRequest request);
    Task<List<UserResponse>> GetUsersByNodeIdAsync(Guid processNodeId);
    Task<List<UserResponse>> AssignUsersToNodeAsync(Guid processNodeId, AssignProcessNodeUsersRequest request);
}

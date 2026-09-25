using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;

namespace Sicou.Application.Interfaces.Services;

public interface IProcessNodeService
{
    Task<IReadOnlyList<ProcessNodeResponse>> GetByAreaIdAsync(Guid areaId);
    Task<ProcessNodeResponse> GetByIdAsync(Guid id);
    Task<ProcessNodeResponse> CreateAsync(Guid areaId, CreateProcessNodeRequest request);
    Task<ProcessNodeResponse> UpdateAsync(Guid id, UpdateProcessNodeRequest request);
    Task DeleteAsync(Guid id);
}

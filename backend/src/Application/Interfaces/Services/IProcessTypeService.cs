using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;

namespace Sicou.Application.Interfaces.Services;

public interface IProcessTypeService
{
    Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetByAreaIdAsync(Guid areaId);
    Task<ProcessTypeResponse> GetByIdAsync(Guid id);
    Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetAvailableForOpeningAsync();
    Task<ProcessTypeResponse> CreateAsync(Guid areaId, CreateProcessTypeRequest request);
    Task<ProcessTypeResponse> UpdateAsync(Guid id, UpdateProcessTypeRequest request);
    Task<ProcessTypeResponse> CloneToNewVersionAsync(Guid id);
    Task<ProcessTypeResponse> HomologateAsync(Guid id);
    Task DeleteAsync(Guid id);
}

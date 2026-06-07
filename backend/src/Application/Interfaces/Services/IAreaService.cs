using Sicou.Application.Requests.Areas;
using Sicou.Application.Responses.Areas;

namespace Sicou.Application.Interfaces.Services;

public interface IAreaService
{
    Task<AreaResponse> CreateAsync(Guid companyId, CreateAreaRequest request);

    Task<IReadOnlyList<AreaResponse>> GetByCompanyIdAsync(Guid companyId);

    Task<AreaResponse> GetByIdAsync(Guid id);

    Task<AreaResponse> UpdateAsync(Guid id, UpdateAreaRequest request);

    Task<AreaResponse> UpdateModulesAsync(Guid id, UpdateAreaModulesRequest request);

    Task DeleteAsync(Guid id);
}
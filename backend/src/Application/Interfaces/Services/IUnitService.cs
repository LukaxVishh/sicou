using Sicou.Application.Requests.Units;
using Sicou.Application.Responses.Units;

namespace Sicou.Application.Interfaces.Services;

public interface IUnitService
{
    Task<UnitResponse> CreateAsync(Guid companyId, CreateUnitRequest request);

    Task<IReadOnlyList<UnitResponse>> GetByCompanyIdAsync(Guid companyId);

    Task<UnitResponse> GetByIdAsync(Guid id);

    Task<UnitResponse> UpdateAsync(Guid id, UpdateUnitRequest request);

    Task DeleteAsync(Guid id);
}
using Sicou.Application.Requests.UserAreaAccesses;
using Sicou.Application.Responses.UserAreaAccesses;

namespace Sicou.Application.Interfaces.Services;

public interface IUserAreaAccessService
{
    Task<UserAreaAccessResponse> CreateAsync(CreateUserAreaAccessRequest request);

    Task<UserAreaAccessResponse?> GetByIdAsync(Guid id);

    Task<List<UserAreaAccessResponse>> GetByUserIdAsync(string userId);

    Task<List<UserAreaAccessResponse>> GetByCompanyIdAsync(Guid companyId);

    Task<UserAreaAccessResponse?> UpdateAsync(Guid id, UpdateUserAreaAccessRequest request);

    Task<bool> DeleteAsync(Guid id);
}
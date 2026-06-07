using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface IUserAreaAccessRepository
{
    Task<UserAreaAccess?> GetByIdAsync(Guid id);

    Task<UserAreaAccess?> GetByUserCompanyUnitAreaAsync(
        string userId,
        Guid companyId,
        Guid? unitId,
        Guid areaId);

    Task<List<UserAreaAccess>> GetByUserIdAsync(string userId);

    Task<List<UserAreaAccess>> GetByCompanyIdAsync(Guid companyId);

    Task AddAsync(UserAreaAccess access);

    Task UpdateAsync(UserAreaAccess access);

    Task SaveChangesAsync();
}
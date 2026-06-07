using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface IUnitRepository
{
    Task<Unit?> GetByIdAsync(Guid id);

    Task<IReadOnlyList<Unit>> GetByCompanyIdAsync(Guid companyId);

    Task<bool> ExistsByNameAsync(Guid companyId, string name, Guid? ignoreId = null);

    Task<bool> ExistsByCodeAsync(Guid companyId, string code, Guid? ignoreId = null);

    Task AddAsync(Unit unit);

    void Update(Unit unit);

    Task SaveChangesAsync();
}
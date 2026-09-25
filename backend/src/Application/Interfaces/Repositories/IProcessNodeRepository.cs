using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface IProcessNodeRepository
{
    Task<ProcessNode?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<ProcessNode>> GetByAreaIdAsync(Guid areaId);
    Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null);
    Task AddAsync(ProcessNode node);
    void Update(ProcessNode node);
    Task SaveChangesAsync();
}

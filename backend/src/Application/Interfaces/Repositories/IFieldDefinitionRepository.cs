using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface IFieldDefinitionRepository
{
    Task<FieldDefinition?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<FieldDefinition>> GetByAreaIdAsync(Guid areaId);
    Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null);
    Task AddAsync(FieldDefinition field);
    void Update(FieldDefinition field);
    Task SaveChangesAsync();
}

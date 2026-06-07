using Sicou.Domain.Entities;
using Sicou.Domain.Enums;

namespace Sicou.Application.Interfaces.Repositories;

public interface IAreaRepository
{
    Task<Area?> GetByIdAsync(Guid id);

    Task<Area?> GetByIdWithModulesAsync(Guid id);

    Task<IReadOnlyList<Area>> GetByCompanyIdAsync(Guid companyId);

    Task<bool> ExistsBySlugAsync(Guid companyId, string slug, Guid? ignoreId = null);

    Task<List<Module>> GetModulesByCodesAsync(IEnumerable<ModuleCode> codes);

    Task AddAsync(Area area);

    void Update(Area area);

    void RemoveAreaModules(IEnumerable<AreaModule> areaModules);

    Task SaveChangesAsync();
}
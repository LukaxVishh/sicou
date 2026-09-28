using Sicou.Domain.Entities;
using Sicou.Domain.Enums;

namespace Sicou.Application.Interfaces.Repositories;

public interface IProcessTypeRepository
{
    Task<ProcessType?> GetByIdAsync(Guid id);
    Task<ProcessType?> GetCompleteTreeAsync(Guid id);
    Task<IReadOnlyList<ProcessType>> GetByAreaIdAsync(Guid areaId);
    Task<IReadOnlyList<ProcessType>> GetAvailableForAudienceAsync(Guid? companyId, ProcessAudience? userAudience, bool includeAllDrafts = false, IEnumerable<Guid>? draftAreaIds = null);
    Task<ProcessType?> GetLatestHomologatedByFamilyIdAsync(Guid familyId);
    Task<int> GetMaxVersionNumberByFamilyIdAsync(Guid familyId);
    Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null);
    Task AddAsync(ProcessType processType);
    void Update(ProcessType processType);
    void RemoveNodes(IEnumerable<ProcessTypeNode> nodes);
    void AddNodes(IEnumerable<ProcessTypeNode> nodes);
    void RemoveFields(IEnumerable<ProcessTypeField> fields);
    void AddFields(IEnumerable<ProcessTypeField> fields);
    void RemoveTransitions(IEnumerable<ProcessTransition> transitions);
    void AddTransitions(IEnumerable<ProcessTransition> transitions);
    Task SaveChangesAsync();
}

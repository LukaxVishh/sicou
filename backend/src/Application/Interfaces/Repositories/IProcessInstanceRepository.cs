using Sicou.Domain.Entities;
using Sicou.Domain.Enums;

namespace Sicou.Application.Interfaces.Repositories;

public interface IProcessInstanceRepository
{
    Task<ProcessInstance?> GetByIdAsync(Guid id);
    Task<ProcessInstance?> GetCompleteInstanceAsync(Guid id);
    Task<IReadOnlyList<ProcessInstance>> GetByAreaIdAsync(Guid areaId, ProcessStatus? status = null);
    Task<IReadOnlyList<ProcessInstance>> GetByCompanyIdAsync(Guid companyId, ProcessStatus? status = null);
    Task<IReadOnlyList<ProcessInstance>> GetByUserIdAsync(string userId);
    Task<string> GenerateProcessNumberAsync(Guid companyId, Guid areaId);
    Task AddAsync(ProcessInstance instance);
    void Update(ProcessInstance instance);
    void AddHistory(ProcessHistory history);
    void AddFieldValue(ProcessFieldValue fieldValue);
    Task SaveChangesAsync();
}

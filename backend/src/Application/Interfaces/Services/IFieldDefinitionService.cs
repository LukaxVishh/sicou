using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;

namespace Sicou.Application.Interfaces.Services;

public interface IFieldDefinitionService
{
    Task<IReadOnlyList<FieldDefinitionResponse>> GetByAreaIdAsync(Guid areaId);
    Task<FieldDefinitionResponse> GetByIdAsync(Guid id);
    Task<FieldDefinitionResponse> CreateAsync(Guid areaId, CreateFieldDefinitionRequest request);
    Task<FieldDefinitionResponse> UpdateAsync(Guid id, UpdateFieldDefinitionRequest request);
    Task DeleteAsync(Guid id);
}

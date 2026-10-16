using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Enums;

namespace Sicou.Application.Interfaces.Services;

public interface IProcessInstanceService
{
    Task<IReadOnlyList<ProcessInstanceSummaryResponse>> GetAreaProcessesAsync(Guid areaId, ProcessStatus? status = null, ProcessSearchFilterRequest? filter = null);
    Task<IReadOnlyList<ProcessInstanceSummaryResponse>> SearchProcessesAsync(ProcessSearchFilterRequest filter);
    Task<IReadOnlyList<ProcessInstanceSummaryResponse>> GetMyProcessesAsync();
    Task<ProcessInstanceResponse> GetByIdAsync(Guid id);
    Task<ProcessInstanceResponse> CreateAsync(CreateProcessInstanceRequest request);
    Task<ProcessInstanceResponse> UpdateDraftAsync(Guid id, UpdateProcessDraftRequest request);
    Task<ProcessInstanceResponse> ProtocolAsync(Guid id, ProtocolProcessRequest request);
    Task<ProcessInstanceResponse> AdvanceAsync(Guid id, AdvanceProcessRequest request);
    Task<ProcessInstanceResponse> ReturnAsync(Guid id, ReturnProcessRequest request);
    Task<ProcessInstanceResponse> RestartAsync(Guid id, RestartProcessRequest request);
    Task<ProcessInstanceResponse> AddCommentAsync(Guid id, AddProcessCommentRequest request);
    Task<ProcessInstanceResponse> CancelAsync(Guid id, CancelProcessRequest request);
    Task<ProcessInstanceResponse> TransferAsync(Guid id, TransferProcessRequest request);
}

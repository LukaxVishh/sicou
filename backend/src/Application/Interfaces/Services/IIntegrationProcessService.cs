using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Integrations;
using Sicou.Application.Responses.Workflows;

namespace Sicou.Application.Interfaces.Services;

/// <summary>
/// Operações de Workflows executadas por uma integração (sem usuário). O alcance é a empresa da integração;
/// as regras do fluxo (obrigatoriedade, transições, estados) são as mesmas da interface web.
/// </summary>
public interface IIntegrationProcessService
{
    Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetWorkflowsAsync(IntegrationIdentity integration);
    Task<ProcessTypeResponse> GetWorkflowAsync(IntegrationIdentity integration, Guid id);
    Task<IReadOnlyList<ProcessInstanceSummaryResponse>> SearchAsync(IntegrationIdentity integration, ProcessSearchFilterRequest filter, bool onlyOpenedByIntegration);
    Task<ProcessInstanceResponse> GetAsync(IntegrationIdentity integration, Guid id);

    /// <summary>Abre o processo. Com <c>IsDraft=false</c>, protocola na mesma gravação (atômico).</summary>
    Task<ProcessInstanceResponse> CreateAsync(IntegrationIdentity integration, CreateProcessInstanceRequest request, string? observations);
    Task<ProcessInstanceResponse> UpdateDraftAsync(IntegrationIdentity integration, Guid id, UpdateProcessDraftRequest request);
    Task<ProcessInstanceResponse> SubmitAsync(IntegrationIdentity integration, Guid id, ProtocolProcessRequest request);
    Task<ProcessInstanceResponse> AdvanceAsync(IntegrationIdentity integration, Guid id, AdvanceProcessRequest request);
    Task<ProcessInstanceResponse> ReturnAsync(IntegrationIdentity integration, Guid id, ReturnProcessRequest request);
    Task<ProcessInstanceResponse> RestartAsync(IntegrationIdentity integration, Guid id, RestartProcessRequest request);
    Task<ProcessInstanceResponse> CommentAsync(IntegrationIdentity integration, Guid id, AddProcessCommentRequest request);
    Task<ProcessInstanceResponse> CancelAsync(IntegrationIdentity integration, Guid id, CancelProcessRequest request);
    Task<ProcessInstanceResponse> TransferAsync(IntegrationIdentity integration, Guid id, TransferProcessRequest request);
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sicou.Api.Integrations;
using Sicou.Api.Responses;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Integrations;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

/// <summary>
/// API de integração dos Workflows para agentes e sistemas externos (RF-021 / RF-023 / UC-020).
/// A integração autentica com <c>Bearer sic_...</c>, opera nos dados da sua empresa e cada operação exige um escopo.
/// </summary>
[ApiController]
[Route("api/integrations/v1")]
[ApiExplorerSettings(GroupName = IntegrationSwagger.DocumentName)]
[Authorize(AuthenticationSchemes = IntegrationAuth.Scheme)]
[EnableRateLimiting(IntegrationAuth.RateLimitPolicy)]
[Produces("application/json")]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status403Forbidden)]
[ProducesResponseType<ApiErrorResponse>(StatusCodes.Status429TooManyRequests)]
public class IntegrationWorkflowsController(IIntegrationProcessService service) : ControllerBase
{
    private IntegrationIdentity Integration => User.ToIntegration();

    // ---------------------------------------------------------------- Identidade

    /// <summary>Identifica a integração autenticada.</summary>
    /// <remarks>Nome, sistema externo, empresa e escopos. Não exige escopo.</remarks>
    [HttpGet("me")]
    [Tags("Identidade")]
    [ProducesResponseType<IntegrationWhoAmIResponse>(StatusCodes.Status200OK)]
    public IActionResult WhoAmI()
    {
        var integration = Integration;
        return Ok(new IntegrationWhoAmIResponse
        {
            IntegrationId = integration.TokenId,
            Name = integration.Name,
            ExternalSystem = integration.ExternalSystem,
            CompanyId = integration.CompanyId,
            Scopes = integration.Scopes.ToList()
        });
    }

    // ---------------------------------------------------------------- Workflows (tipos de processo)

    /// <summary>Lista os workflows homologados e ativos da empresa.</summary>
    [HttpGet("workflows")]
    [Tags("Workflows")]
    [RequireScope(IntegrationScopes.WorkflowsRead)]
    [ProducesResponseType<IReadOnlyList<ProcessTypeSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkflows() => Ok(await service.GetWorkflowsAsync(Integration));

    /// <summary>Detalha um workflow: etapas, campos (com códigos) e transições.</summary>
    /// <remarks>Use os <c>code</c> dos campos em <c>fields</c> e os <c>code</c> das etapas em <c>targetNodeCode</c>.</remarks>
    [HttpGet("workflows/{id:guid}")]
    [Tags("Workflows")]
    [RequireScope(IntegrationScopes.WorkflowsRead)]
    [ProducesResponseType<ProcessTypeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkflow(Guid id) => Ok(await service.GetWorkflowAsync(Integration, id));

    // ---------------------------------------------------------------- Consulta de processos

    /// <summary>Lista processos da empresa, com filtros e paginação.</summary>
    /// <remarks><c>mine=true</c> restringe aos processos abertos por esta integração.</remarks>
    [HttpGet("processes")]
    [Tags("Processos — consulta")]
    [RequireScope(IntegrationScopes.ProcessesRead)]
    [ProducesResponseType<IntegrationPage<ProcessInstanceSummaryResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ListProcesses([FromQuery] IntegrationProcessQuery query)
    {
        if (query.StartDate.HasValue && query.EndDate.HasValue && query.StartDate > query.EndDate)
            throw new InvalidOperationException("startDate deve ser anterior ou igual a endDate.");

        var list = await service.SearchAsync(Integration, new ProcessSearchFilterRequest
        {
            AreaId = query.AreaId,
            Status = query.Status,
            SearchTerm = query.Search,
            UnitId = query.UnitId,
            StartDate = query.StartDate,
            EndDate = query.EndDate
        }, query.Mine);

        return Ok(new IntegrationPage<ProcessInstanceSummaryResponse>
        {
            Total = list.Count,
            Page = query.Page,
            PageSize = query.PageSize,
            Items = list.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToList()
        });
    }

    /// <summary>Consulta o processo completo: campos preenchidos e histórico.</summary>
    [HttpGet("processes/{id:guid}")]
    [Tags("Processos — consulta")]
    [RequireScope(IntegrationScopes.ProcessesRead)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProcess(Guid id) => Ok(await service.GetAsync(Integration, id));

    /// <summary>Status do processo e próximos passos possíveis.</summary>
    /// <remarks>Etapa atual, campos obrigatórios pendentes, destinos de avanço/devolução e ações coerentes com o estado.</remarks>
    [HttpGet("processes/{id:guid}/status")]
    [Tags("Processos — consulta")]
    [RequireScope(IntegrationScopes.ProcessesRead)]
    [ProducesResponseType<IntegrationProcessStatusResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStatus(Guid id)
    {
        var integration = Integration;
        var process = await service.GetAsync(integration, id);
        var tree = await service.GetWorkflowAsync(integration, process.ProcessTypeId);
        return Ok(IntegrationWorkflowMapper.BuildStatus(process, tree));
    }

    /// <summary>Histórico do processo, do mais antigo ao mais recente.</summary>
    [HttpGet("processes/{id:guid}/history")]
    [Tags("Processos — consulta")]
    [RequireScope(IntegrationScopes.ProcessesRead)]
    [ProducesResponseType<IReadOnlyList<ProcessHistoryResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistory(Guid id)
        => Ok((await service.GetAsync(Integration, id)).History.OrderBy(h => h.CreatedAt).ToList());

    // ---------------------------------------------------------------- Abertura

    /// <summary>Abre um processo (e, por padrão, já protocola).</summary>
    /// <remarks>
    /// Com <c>submit=true</c> (padrão), abertura e protocolo são gravados juntos: se faltar campo obrigatório da etapa
    /// inicial, nada é gravado. Com <c>submit=false</c>, cria um rascunho.
    /// </remarks>
    [HttpPost("processes")]
    [Tags("Processos — abertura")]
    [RequireScope(IntegrationScopes.ProcessesCreate)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateProcess([FromBody] IntegrationCreateProcessRequest request)
    {
        var integration = Integration;
        var tree = await service.GetWorkflowAsync(integration, request.WorkflowId!.Value);
        var result = await service.CreateAsync(integration, new CreateProcessInstanceRequest
        {
            ProcessTypeId = tree.Id,
            Title = request.Title,
            OriginUnitId = request.OriginUnitId,
            IsDraft = !request.Submit,
            InitialFieldValues = IntegrationWorkflowMapper.ResolveFields(request.Fields, tree)
        }, request.Observations);
        return CreatedAtAction(nameof(GetProcess), new { id = result.Id }, result);
    }

    /// <summary>Atualiza título, unidade de origem ou campos de um rascunho.</summary>
    [HttpPut("processes/{id:guid}/draft")]
    [Tags("Processos — abertura")]
    [RequireScope(IntegrationScopes.ProcessesCreate)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDraft(Guid id, [FromBody] IntegrationUpdateDraftRequest request)
    {
        var (integration, tree) = await TreeOfAsync(id);
        return Ok(await service.UpdateDraftAsync(integration, id, new UpdateProcessDraftRequest
        {
            Title = request.Title,
            OriginUnitId = request.OriginUnitId,
            FieldValues = IntegrationWorkflowMapper.ResolveFields(request.Fields, tree)
        }));
    }

    /// <summary>Protocola (envia) um rascunho ou reenvia um processo devolvido.</summary>
    [HttpPost("processes/{id:guid}/submit")]
    [Tags("Processos — abertura")]
    [RequireScope(IntegrationScopes.ProcessesCreate)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid id, [FromBody] IntegrationSubmitRequest request)
    {
        var (integration, tree) = await TreeOfAsync(id);
        return Ok(await service.SubmitAsync(integration, id, new ProtocolProcessRequest
        {
            Title = request.Title,
            Observations = request.Observations,
            FieldValues = IntegrationWorkflowMapper.ResolveFields(request.Fields, tree)
        }));
    }

    // ---------------------------------------------------------------- Tramitação

    /// <summary>Avança o processo para a próxima etapa ("passar para frente").</summary>
    /// <remarks>
    /// Informe <c>targetNodeId</c> ou <c>targetNodeCode</c> quando houver mais de uma saída (veja <c>advanceTargets</c>
    /// em <c>/status</c>). Os campos obrigatórios da etapa atual podem ser enviados em <c>fields</c>.
    /// </remarks>
    [HttpPost("processes/{id:guid}/advance")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesMove)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Advance(Guid id, [FromBody] IntegrationAdvanceRequest request)
    {
        var (integration, tree) = await TreeOfAsync(id);
        return Ok(await service.AdvanceAsync(integration, id, new AdvanceProcessRequest
        {
            TargetNodeId = IntegrationWorkflowMapper.ResolveNode(request.TargetNodeId, request.TargetNodeCode, tree),
            Observations = request.Observations,
            FieldValues = IntegrationWorkflowMapper.ResolveFields(request.Fields, tree)
        }));
    }

    /// <summary>Devolve o processo para uma etapa anterior ("retornar").</summary>
    /// <remarks>Sem destino informado, usa a primeira etapa com retorno permitido ou, na falta dela, a etapa inicial.</remarks>
    [HttpPost("processes/{id:guid}/return")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesMove)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Return(Guid id, [FromBody] IntegrationReturnRequest request)
    {
        var (integration, tree) = await TreeOfAsync(id);
        return Ok(await service.ReturnAsync(integration, id, new ReturnProcessRequest
        {
            TargetNodeId = IntegrationWorkflowMapper.ResolveNode(request.TargetNodeId, request.TargetNodeCode, tree),
            Observations = request.Observations
        }));
    }

    /// <summary>Reinicia o fluxo, levando o processo de volta à etapa inicial.</summary>
    [HttpPost("processes/{id:guid}/restart")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesMove)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restart(Guid id, [FromBody] IntegrationRestartRequest request)
        => Ok(await service.RestartAsync(Integration, id, new RestartProcessRequest { Observations = request.Observations }));

    /// <summary>Registra parecer/observação no histórico, sem movimentar o processo.</summary>
    [HttpPost("processes/{id:guid}/comments")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesComment)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Comment(Guid id, [FromBody] IntegrationCommentRequest request)
        => Ok(await service.CommentAsync(Integration, id, new AddProcessCommentRequest { Observations = request.Observations }));

    /// <summary>Cancela o processo administrativamente (definitivo).</summary>
    [HttpPost("processes/{id:guid}/cancel")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesCancel)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] IntegrationCancelRequest request)
        => Ok(await service.CancelAsync(Integration, id, new CancelProcessRequest { Reason = request.Reason }));

    /// <summary>Transfere o processo para outra unidade da mesma empresa, mantendo etapa e status.</summary>
    [HttpPost("processes/{id:guid}/transfer")]
    [Tags("Processos — tramitação")]
    [RequireScope(IntegrationScopes.ProcessesTransfer)]
    [ProducesResponseType<ProcessInstanceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Transfer(Guid id, [FromBody] IntegrationTransferRequest request)
        => Ok(await service.TransferAsync(Integration, id, new TransferProcessRequest
        {
            DestinationUnitId = request.DestinationUnitId,
            DestinationUnitName = request.DestinationUnitName,
            Observations = request.Observations
        }));

    /// <summary>Carrega o processo (verificando a empresa) e a árvore dele, para traduzir códigos.</summary>
    private async Task<(IntegrationIdentity, ProcessTypeResponse)> TreeOfAsync(Guid processId)
    {
        var integration = Integration;
        var process = await service.GetAsync(integration, processId);
        return (integration, await service.GetWorkflowAsync(integration, process.ProcessTypeId));
    }
}

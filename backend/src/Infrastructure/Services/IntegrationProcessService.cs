using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Integrations;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Services;

/// <summary>
/// Executa operações de Workflows em nome de uma integração (UC-020), sem usuário associado.
/// Autorização: o processo/workflow precisa pertencer à empresa da integração; o escopo da rota é verificado na API.
/// Regras do fluxo reaproveitadas de <see cref="ProcessInstanceService"/>: campos obrigatórios por etapa,
/// resolução de status por etapa, estados terminais e mapeamentos de resposta.
/// O histórico registra a integração como autora ("Integração · nome").
/// </summary>
public class IntegrationProcessService(
    IProcessInstanceRepository instances,
    IProcessTypeRepository processTypes,
    ApplicationDbContext db) : IIntegrationProcessService
{
    // ---------------------------------------------------------------- Consultas

    public async Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetWorkflowsAsync(IntegrationIdentity integration)
    {
        var available = await processTypes.GetAvailableForAudienceAsync(integration.CompanyId, null);
        return available.Select(ProcessTypeService.MapToSummaryResponse).ToList();
    }

    public async Task<ProcessTypeResponse> GetWorkflowAsync(IntegrationIdentity integration, Guid id)
        => ProcessTypeService.MapToCompleteResponse(await TreeAsync(integration, id));

    public async Task<IReadOnlyList<ProcessInstanceSummaryResponse>> SearchAsync(
        IntegrationIdentity integration, ProcessSearchFilterRequest filter, bool onlyOpenedByIntegration)
    {
        IEnumerable<ProcessInstance> list = await instances.GetByCompanyIdAsync(integration.CompanyId, filter.Status);
        if (filter.AreaId.HasValue) list = list.Where(p => p.AreaId == filter.AreaId.Value);
        if (onlyOpenedByIntegration) list = list.Where(p => p.CreatedByUserId == integration.ActorId);
        return ProcessInstanceService.ApplySearchFilters(list, filter).Select(ProcessInstanceService.MapToSummaryResponse).ToList();
    }

    public async Task<ProcessInstanceResponse> GetAsync(IntegrationIdentity integration, Guid id)
        => Map(integration, await InstanceAsync(integration, id));

    // ---------------------------------------------------------------- Abertura

    public async Task<ProcessInstanceResponse> CreateAsync(IntegrationIdentity integration, CreateProcessInstanceRequest request, string? observations)
    {
        var tree = await TreeAsync(integration, request.ProcessTypeId);
        if (!tree.IsActive || tree.Status != ProcessTypeStatus.Homologated)
            throw new InvalidOperationException("Este workflow não está homologado e ativo para abertura.");
        if (!tree.StartNodeId.HasValue)
            throw new InvalidOperationException("A árvore do processo não possui um ponto de partida definido.");

        var originUnitId = await ValidateUnitAsync(integration, request.OriginUnitId);
        if (tree.TargetAudience == ProcessAudience.UnitsOnly && !originUnitId.HasValue)
            throw new InvalidOperationException("Este workflow é restrito a unidades: informe originUnitId.");
        if (tree.TargetAudience == ProcessAudience.HeadquartersOnly && originUnitId.HasValue)
            throw new InvalidOperationException("Este workflow é restrito à sede: não informe originUnitId.");

        var number = await instances.GenerateProcessNumberAsync(integration.CompanyId, tree.AreaId);
        var instance = new ProcessInstance
        {
            CompanyId = integration.CompanyId,
            AreaId = tree.AreaId,
            ProcessTypeId = tree.Id,
            CurrentNodeId = tree.StartNodeId.Value,
            ProcessNumber = number,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{tree.Name} - {number}" : request.Title.Trim(),
            Status = ProcessStatus.Draft,
            CreatedByUserId = integration.ActorId,
            CreatedByUserName = integration.ActorName,
            OriginUnitId = originUnitId,
            CurrentUnitId = originUnitId
        };
        foreach (var (fieldId, value) in request.InitialFieldValues ?? [])
            instance.FieldValues.Add(new ProcessFieldValue { FieldDefinitionId = fieldId, Value = value });

        instance.History.Add(History(integration, null, tree.StartNodeId.Value, ProcessActionType.Comment, "Processo iniciado via integração."));

        if (!request.IsDraft)
        {
            ProcessInstanceService.ValidateRequiredNodeFields(tree, instance.CurrentNodeId, instance.FieldValues, null,
                isRejectingTransition: false, observations);
            Protocol(integration, instance, tree, string.IsNullOrWhiteSpace(observations) ? "Processo aberto e protocolado via integração." : observations.Trim(),
                addHistory: history => instance.History.Add(history));
        }

        await instances.AddAsync(instance);
        await instances.SaveChangesAsync(); // gravação única: abertura e protocolo são atômicos
        return await ReloadAsync(integration, instance.Id);
    }

    public async Task<ProcessInstanceResponse> UpdateDraftAsync(IntegrationIdentity integration, Guid id, UpdateProcessDraftRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        if (instance.Status != ProcessStatus.Draft)
            throw new InvalidOperationException("Apenas rascunhos de processos podem ser alterados.");

        if (!string.IsNullOrWhiteSpace(request.Title)) instance.Title = request.Title.Trim();
        if (request.OriginUnitId.HasValue)
        {
            instance.OriginUnitId = await ValidateUnitAsync(integration, request.OriginUnitId);
            instance.CurrentUnitId = instance.OriginUnitId;
        }
        UpsertFields(instance, request.FieldValues);
        instance.UpdatedAt = DateTime.UtcNow;
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> SubmitAsync(IntegrationIdentity integration, Guid id, ProtocolProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        if (instance.Status != ProcessStatus.Draft && instance.Status != ProcessStatus.Returned)
            throw new InvalidOperationException("Este processo já se encontra protocolado e em tramitação.");

        var tree = await TreeOfAsync(instance);
        ProcessInstanceService.ValidateRequiredNodeFields(tree, instance.CurrentNodeId, instance.FieldValues, request.FieldValues,
            isRejectingTransition: false, request.Observations);

        if (!string.IsNullOrWhiteSpace(request.Title)) instance.Title = request.Title.Trim();
        UpsertFields(instance, request.FieldValues);
        Protocol(integration, instance, tree,
            string.IsNullOrWhiteSpace(request.Observations) ? "Processo protocolado via integração." : request.Observations.Trim(),
            instances.AddHistory);
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    // ---------------------------------------------------------------- Tramitação

    public async Task<ProcessInstanceResponse> AdvanceAsync(IntegrationIdentity integration, Guid id, AdvanceProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        EnsureInProgress(instance, "tramitar");
        var tree = await TreeOfAsync(instance);

        var transitions = tree.Transitions.Where(t => t.FromNodeId == instance.CurrentNodeId && t.AllowAdvance).ToList();
        if (transitions.Count == 0)
            throw new InvalidOperationException("Não existem transições de avanço permitidas a partir do local atual.");
        var transition = request.TargetNodeId.HasValue
            ? transitions.FirstOrDefault(t => t.ToNodeId == request.TargetNodeId.Value)
              ?? throw new InvalidOperationException("A transição para o local de destino especificado não é permitida.")
            : transitions.First();

        var nextStatus = ProcessInstanceService.ResolveStatusForNode(transition.ToNode);
        ProcessInstanceService.ValidateRequiredNodeFields(tree, instance.CurrentNodeId, instance.FieldValues, request.FieldValues,
            isRejectingTransition: nextStatus == ProcessStatus.Rejected, request.Observations);

        UpsertFields(instance, request.FieldValues);
        var from = instance.CurrentNodeId;
        instance.CurrentNodeId = transition.ToNodeId;
        instance.Status = nextStatus;
        instance.UpdatedAt = DateTime.UtcNow;
        instances.AddHistory(History(integration, from, transition.ToNodeId, ProcessActionType.Advance,
            string.IsNullOrWhiteSpace(request.Observations) ? "Processo avançado para a próxima etapa via integração." : request.Observations.Trim(), instance.Id));
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> ReturnAsync(IntegrationIdentity integration, Guid id, ReturnProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        EnsureInProgress(instance, "devolver");
        RequireText(request.Observations, "A justificativa para devolução é obrigatória.");
        var tree = await TreeOfAsync(instance);

        var transitions = tree.Transitions.Where(t => t.ToNodeId == instance.CurrentNodeId && t.AllowReturn).ToList();
        Guid target;
        if (request.TargetNodeId.HasValue)
        {
            if (!transitions.Any(t => t.FromNodeId == request.TargetNodeId.Value))
                throw new InvalidOperationException("Não é permitido devolver para o local de destino especificado.");
            target = request.TargetNodeId.Value;
        }
        else if (transitions.Count > 0) target = transitions.First().FromNodeId;
        else target = tree.StartNodeId ?? throw new InvalidOperationException("Não foi possível determinar o local de devolução.");

        var from = instance.CurrentNodeId;
        instance.CurrentNodeId = target;
        instance.Status = ProcessStatus.Returned;
        instance.UpdatedAt = DateTime.UtcNow;
        instances.AddHistory(History(integration, from, target, ProcessActionType.Return, request.Observations.Trim(), instance.Id));
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> RestartAsync(IntegrationIdentity integration, Guid id, RestartProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        EnsureInProgress(instance, "reiniciar");
        RequireText(request.Observations, "A justificativa para reinício é obrigatória.");
        var tree = await TreeOfAsync(instance);
        var start = tree.StartNodeId ?? throw new InvalidOperationException("Ponto de partida da árvore não encontrado.");

        var from = instance.CurrentNodeId;
        instance.CurrentNodeId = start;
        instance.Status = ProcessStatus.Returned;
        instance.UpdatedAt = DateTime.UtcNow;
        instances.AddHistory(History(integration, from, start, ProcessActionType.Restart, request.Observations.Trim(), instance.Id));
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> CommentAsync(IntegrationIdentity integration, Guid id, AddProcessCommentRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        if (ProcessInstanceService.IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível adicionar parecer em um processo que já foi concluído ou cancelado.");
        RequireText(request.Observations, "O parecer/observação é obrigatório.");

        instances.AddHistory(History(integration, instance.CurrentNodeId, instance.CurrentNodeId, ProcessActionType.Comment,
            request.Observations.Trim(), instance.Id));
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> CancelAsync(IntegrationIdentity integration, Guid id, CancelProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        if (instance.Status == ProcessStatus.AdministrativeCancellation)
            throw new InvalidOperationException("Este processo já se encontra cancelado administrativamente.");
        if (ProcessInstanceService.IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível cancelar um processo que já atingiu um estado de conclusão final.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5)
            throw new InvalidOperationException("A justificativa do cancelamento é obrigatória e deve conter pelo menos 5 caracteres.");

        instance.Status = ProcessStatus.AdministrativeCancellation;
        instance.UpdatedAt = DateTime.UtcNow;
        instances.AddHistory(History(integration, instance.CurrentNodeId, instance.CurrentNodeId, ProcessActionType.Cancel,
            $"Cancelamento Administrativo: {request.Reason.Trim()}", instance.Id));
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    public async Task<ProcessInstanceResponse> TransferAsync(IntegrationIdentity integration, Guid id, TransferProcessRequest request)
    {
        var instance = await InstanceAsync(integration, id);
        if (ProcessInstanceService.IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível transferir um processo que já foi concluído ou cancelado.");
        if (string.IsNullOrWhiteSpace(request.Observations) || request.Observations.Trim().Length < 5)
            throw new InvalidOperationException("O motivo / justificativa da transferência é obrigatório (mínimo de 5 caracteres).");

        var previousUnitId = instance.CurrentUnitId ?? instance.OriginUnitId;
        var previousUnitName = !string.IsNullOrWhiteSpace(instance.CurrentUnitName)
            ? instance.CurrentUnitName
            : instance.CurrentUnit?.Name ?? instance.OriginUnit?.Name ?? (instance.Area != null ? $"Sede - {instance.Area.Name}" : "Sede da Empresa");

        Guid? newUnitId;
        string newUnitName;
        if (request.DestinationUnitId.HasValue)
        {
            var unit = await db.Units.FirstOrDefaultAsync(u => u.Id == request.DestinationUnitId.Value && u.CompanyId == instance.CompanyId && u.IsActive)
                ?? throw new KeyNotFoundException("Unidade de destino não encontrada ou inativa nesta empresa.");
            newUnitId = unit.Id;
            newUnitName = unit.Name;
        }
        else if (!string.IsNullOrWhiteSpace(request.DestinationUnitName))
        {
            var name = request.DestinationUnitName.Trim();
            var unit = await db.Units.FirstOrDefaultAsync(u => u.CompanyId == instance.CompanyId && u.IsActive && u.Name.ToLower() == name.ToLower());
            newUnitId = unit?.Id;
            newUnitName = unit?.Name ?? name;
        }
        else throw new InvalidOperationException("Selecione ou informe a unidade de destino para realizar a transferência.");

        if ((newUnitId.HasValue && previousUnitId == newUnitId) || string.Equals(previousUnitName, newUnitName, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"O processo já se encontra lotado na unidade/departamento '{newUnitName}'.");

        instance.CurrentUnitId = newUnitId;
        instance.CurrentUnitName = newUnitName;
        instance.UpdatedAt = DateTime.UtcNow;
        var history = History(integration, instance.CurrentNodeId, instance.CurrentNodeId, ProcessActionType.Transfer,
            $"Transferência de unidade ({previousUnitName} → {newUnitName}): {request.Observations.Trim()}", instance.Id);
        history.FromUnitId = previousUnitId;
        history.FromUnitName = previousUnitName;
        history.ToUnitId = newUnitId;
        history.ToUnitName = newUnitName;
        instances.AddHistory(history);
        await instances.SaveChangesAsync();
        return await ReloadAsync(integration, id);
    }

    // ---------------------------------------------------------------- Apoio

    /// <summary>Carrega a árvore completa, somente se pertencer à empresa da integração.</summary>
    private async Task<ProcessType> TreeAsync(IntegrationIdentity integration, Guid id)
    {
        var tree = await processTypes.GetCompleteTreeAsync(id);
        if (tree is null || tree.Area?.CompanyId != integration.CompanyId)
            throw new KeyNotFoundException("Workflow não encontrado.");
        return tree;
    }

    private async Task<ProcessType> TreeOfAsync(ProcessInstance instance)
        => await processTypes.GetCompleteTreeAsync(instance.ProcessTypeId)
           ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

    /// <summary>Carrega o processo, somente se pertencer à empresa da integração (outra empresa = 404).</summary>
    private async Task<ProcessInstance> InstanceAsync(IntegrationIdentity integration, Guid id)
    {
        var instance = await instances.GetCompleteInstanceAsync(id);
        if (instance is null || instance.CompanyId != integration.CompanyId)
            throw new KeyNotFoundException("Processo não encontrado.");
        return instance;
    }

    private async Task<ProcessInstanceResponse> ReloadAsync(IntegrationIdentity integration, Guid id)
        => Map(integration, (await instances.GetCompleteInstanceAsync(id))!);

    /// <summary><c>canManipulate</c> para a integração: processo em andamento e escopo de tramitação.</summary>
    private static ProcessInstanceResponse Map(IntegrationIdentity integration, ProcessInstance instance)
        => ProcessInstanceService.MapToCompleteResponse(instance,
            !ProcessInstanceService.IsTerminalStatus(instance.Status)
            && instance.Status != ProcessStatus.Draft
            && integration.Scopes.Contains(IntegrationScopes.ProcessesMove));

    private async Task<Guid?> ValidateUnitAsync(IntegrationIdentity integration, Guid? unitId)
    {
        if (!unitId.HasValue) return null;
        if (!await db.Units.AnyAsync(u => u.Id == unitId.Value && u.CompanyId == integration.CompanyId && u.IsActive))
            throw new KeyNotFoundException("Unidade não encontrada ou inativa nesta empresa.");
        return unitId;
    }

    private static void EnsureInProgress(ProcessInstance instance, string action)
    {
        if (ProcessInstanceService.IsTerminalStatus(instance.Status))
            throw new InvalidOperationException($"Não é possível {action} um processo que já foi concluído ou cancelado.");
        if (instance.Status == ProcessStatus.Draft)
            throw new InvalidOperationException($"Protocole o rascunho (submit) antes de {action} o processo.");
    }

    private static void RequireText(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException(message);
    }

    /// <summary>Envia o processo da etapa atual para a primeira transição de avanço (mesma regra do protocolo na interface).</summary>
    private static void Protocol(IntegrationIdentity integration, ProcessInstance instance, ProcessType tree, string observations,
        Action<ProcessHistory> addHistory)
    {
        var from = instance.CurrentNodeId;
        var transition = tree.Transitions.FirstOrDefault(t => t.FromNodeId == from && t.AllowAdvance);
        if (transition is not null)
        {
            instance.CurrentNodeId = transition.ToNodeId;
            instance.Status = ProcessInstanceService.ResolveStatusForNode(transition.ToNode);
        }
        else instance.Status = ProcessStatus.InReview;

        instance.OpenedByUserId ??= integration.ActorId;
        instance.OpenedByUserName ??= integration.ActorName;
        instance.OpenedAt ??= DateTime.UtcNow;
        instance.CurrentUnitId ??= instance.OriginUnitId;
        instance.UpdatedAt = DateTime.UtcNow;
        addHistory(History(integration, from, instance.CurrentNodeId, ProcessActionType.Advance, observations, instance.Id));
    }

    private void UpsertFields(ProcessInstance instance, Dictionary<Guid, string?>? values)
    {
        foreach (var (fieldId, value) in values ?? [])
        {
            var existing = instance.FieldValues.FirstOrDefault(f => f.FieldDefinitionId == fieldId);
            if (existing != null)
            {
                existing.Value = value;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else instances.AddFieldValue(new ProcessFieldValue { ProcessInstanceId = instance.Id, FieldDefinitionId = fieldId, Value = value });
        }
    }

    private static ProcessHistory History(IntegrationIdentity integration, Guid? from, Guid to, ProcessActionType action,
        string observations, Guid processId = default) => new()
    {
        ProcessInstanceId = processId,
        FromNodeId = from,
        ToNodeId = to,
        Action = action,
        UserId = integration.ActorId,
        UserFullName = integration.ActorName,
        Observations = observations
    };
}

using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class ProcessInstanceService : IProcessInstanceService
{
    private readonly IProcessInstanceRepository _instanceRepository;
    private readonly IProcessTypeRepository _processTypeRepository;
    private readonly IAreaRepository _areaRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserAreaAccessRepository _userAreaAccessRepository;

    public ProcessInstanceService(
        IProcessInstanceRepository instanceRepository,
        IProcessTypeRepository processTypeRepository,
        IAreaRepository areaRepository,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IUserAreaAccessRepository userAreaAccessRepository)
    {
        _instanceRepository = instanceRepository;
        _processTypeRepository = processTypeRepository;
        _areaRepository = areaRepository;
        _currentUser = currentUser;
        _userManager = userManager;
        _userAreaAccessRepository = userAreaAccessRepository;
    }

    public async Task<IReadOnlyList<ProcessInstanceSummaryResponse>> GetAreaProcessesAsync(Guid areaId, ProcessStatus? status = null)
    {
        var user = await GetCurrentUserAsync();
        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);
        var isCompanyAdmin = roles.Contains(SystemRoles.CompanyAdmin);

        var area = await _areaRepository.GetByIdAsync(areaId)
            ?? throw new KeyNotFoundException("Área não encontrada.");

        if (!isSuperAdmin && user.CompanyId != area.CompanyId)
            throw new UnauthorizedAccessException("Acesso negado às solicitações de outra empresa.");

        Guid? filterUnitId = null;

        if (!isSuperAdmin && !isCompanyAdmin)
        {
            var isUnitUser = user.UnitId.HasValue && roles.Contains(SystemRoles.UnitUser);
            if (isUnitUser)
            {
                // Usuário de unidade visualiza apenas os processos da sua própria unidade
                filterUnitId = user.UnitId.Value;
            }
            else
            {
                // Usuário da sede visualiza de todas as unidades, mas precisa ter permissão de acesso à área
                var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
                var areaAccess = accesses.FirstOrDefault(a => a.AreaId == areaId && a.IsActive);
                if (areaAccess == null || (!areaAccess.CanView && !areaAccess.CanHandleWorkflowRequests && !areaAccess.CanManage))
                {
                    throw new UnauthorizedAccessException("Você não possui permissão para visualizar processos desta área.");
                }
            }
        }

        var instances = await _instanceRepository.GetByAreaIdAsync(areaId, status, filterUnitId);
        return instances.Select(MapToSummaryResponse).ToList();
    }

    public async Task<IReadOnlyList<ProcessInstanceSummaryResponse>> GetMyProcessesAsync()
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var instances = await _instanceRepository.GetByUserIdAsync(_currentUser.UserId);
        return instances.Select(MapToSummaryResponse).ToList();
    }

    public async Task<ProcessInstanceResponse> GetByIdAsync(Guid id)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException($"Processo com ID '{id}' não encontrado.");

        await ValidateInstanceViewAccessAsync(instance);
        return MapToCompleteResponse(instance);
    }

    public async Task<ProcessInstanceResponse> CreateAsync(CreateProcessInstanceRequest request)
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);
        var isCompanyAdmin = roles.Contains(SystemRoles.CompanyAdmin);

        var processType = await _processTypeRepository.GetCompleteTreeAsync(request.ProcessTypeId)
            ?? throw new KeyNotFoundException("Tipo de processo não encontrado.");

        Guid companyId;
        if (user.CompanyId.HasValue)
        {
            companyId = user.CompanyId.Value;
        }
        else if (isSuperAdmin)
        {
            var area = await _areaRepository.GetByIdAsync(processType.AreaId);
            companyId = area?.CompanyId ?? throw new InvalidOperationException("Não foi possível identificar a empresa vinculada a este processo.");
        }
        else
        {
            throw new InvalidOperationException("Usuário não vinculado a uma empresa.");
        }

        if (!processType.IsActive)
            throw new InvalidOperationException("Este processo está desativado para abertura.");

        if (processType.Status == ProcessTypeStatus.Draft)
        {
            var isAreaAdmin = false;
            if (!isSuperAdmin && !isCompanyAdmin)
            {
                var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
                var areaAccess = accesses.FirstOrDefault(a => a.AreaId == processType.AreaId && a.IsActive);
                isAreaAdmin = areaAccess != null && (areaAccess.CanManage || areaAccess.CanManageWorkflows);
            }

            if (!isSuperAdmin && !isCompanyAdmin && !isAreaAdmin)
            {
                throw new UnauthorizedAccessException("Apenas administradores da área ou da empresa possuem permissão para abrir chamados utilizando árvores em criação/rascunho.");
            }
        }
        else if (processType.Status != ProcessTypeStatus.Homologated)
        {
            throw new InvalidOperationException("Este processo não está homologado para abertura de novos chamados.");
        }

        // Validar audiência
        if (!isSuperAdmin)
        {
            var isUnitUser = user.UnitId.HasValue;
            if (processType.TargetAudience == ProcessAudience.HeadquartersOnly && isUnitUser)
                throw new UnauthorizedAccessException("Este processo é restrito aos colaboradores da sede.");

            if (processType.TargetAudience == ProcessAudience.UnitsOnly && !isUnitUser)
                throw new UnauthorizedAccessException("Este processo é restrito aos colaboradores de unidades/filiais.");
        }

        if (!processType.StartNodeId.HasValue)
            throw new InvalidOperationException("A árvore do processo não possui um ponto de partida definido.");

        var processNumber = await _instanceRepository.GenerateProcessNumberAsync(companyId, processType.AreaId);

        var isDraft = request.IsDraft;
        var initialStatus = isDraft ? ProcessStatus.Draft : ProcessStatus.InReview;

        var instance = new ProcessInstance
        {
            CompanyId = companyId,
            AreaId = processType.AreaId,
            ProcessTypeId = processType.Id,
            CurrentNodeId = processType.StartNodeId.Value,
            ProcessNumber = processNumber,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{processType.Name} - {processNumber}" : request.Title.Trim(),
            Status = initialStatus,
            CreatedByUserId = user.Id.ToString(),
            CreatedByUserName = user.FullName,
            OriginUnitId = request.OriginUnitId ?? user.UnitId
        };

        // Salvar valores iniciais
        if (request.InitialFieldValues != null)
        {
            foreach (var kvp in request.InitialFieldValues)
            {
                instance.FieldValues.Add(new ProcessFieldValue
                {
                    FieldDefinitionId = kvp.Key,
                    Value = kvp.Value
                });
            }
        }

        // Histórico de criação
        instance.History.Add(new ProcessHistory
        {
            FromNodeId = null,
            ToNodeId = processType.StartNodeId.Value,
            Action = isDraft ? ProcessActionType.Comment : ProcessActionType.Advance,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = isDraft ? "Rascunho do processo iniciado." : "Processo confeccionado e protocolado com sucesso."
        });

        await _instanceRepository.AddAsync(instance);
        await _instanceRepository.SaveChangesAsync();

        var created = await _instanceRepository.GetCompleteInstanceAsync(instance.Id);
        return MapToCompleteResponse(created!);
    }

    public async Task<ProcessInstanceResponse> UpdateDraftAsync(Guid id, UpdateProcessDraftRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleOrCreatorAsync(instance, user);

        if (instance.Status != ProcessStatus.Draft)
            throw new InvalidOperationException("Apenas rascunhos de processos podem ser alterados.");

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            instance.Title = request.Title.Trim();
        }

        if (request.OriginUnitId.HasValue)
        {
            instance.OriginUnitId = request.OriginUnitId.Value;
        }

        if (request.FieldValues != null)
        {
            foreach (var kvp in request.FieldValues)
            {
                var existing = instance.FieldValues.FirstOrDefault(f => f.FieldDefinitionId == kvp.Key);
                if (existing != null)
                {
                    existing.Value = kvp.Value;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _instanceRepository.AddFieldValue(new ProcessFieldValue
                    {
                        ProcessInstanceId = instance.Id,
                        FieldDefinitionId = kvp.Key,
                        Value = kvp.Value
                    });
                }
            }
        }

        instance.UpdatedAt = DateTime.UtcNow;
        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessInstanceResponse> ProtocolAsync(Guid id, ProtocolProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);
        var isCompanyAdmin = roles.Contains(SystemRoles.CompanyAdmin);

        if (!isSuperAdmin && !isCompanyAdmin && instance.CreatedByUserId != user.Id.ToString())
            throw new UnauthorizedAccessException("Apenas o autor ou administradores podem protocolar este processo.");

        if (instance.Status != ProcessStatus.Draft && instance.Status != ProcessStatus.Returned)
            throw new InvalidOperationException("Este processo já se encontra protocolado e em tramitação.");

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            instance.Title = request.Title.Trim();
        }

        if (request.FieldValues != null)
        {
            foreach (var kvp in request.FieldValues)
            {
                var existing = instance.FieldValues.FirstOrDefault(f => f.FieldDefinitionId == kvp.Key);
                if (existing != null)
                {
                    existing.Value = kvp.Value;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _instanceRepository.AddFieldValue(new ProcessFieldValue
                    {
                        ProcessInstanceId = instance.Id,
                        FieldDefinitionId = kvp.Key,
                        Value = kvp.Value
                    });
                }
            }
        }

        var processType = await _processTypeRepository.GetCompleteTreeAsync(instance.ProcessTypeId)
            ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

        var previousNodeId = instance.CurrentNodeId;
        var transitions = processType.Transitions
            .Where(t => t.FromNodeId == instance.CurrentNodeId && t.AllowAdvance)
            .ToList();

        if (transitions.Count > 0)
        {
            var firstTransition = transitions.First();
            instance.CurrentNodeId = firstTransition.ToNodeId;
            if (firstTransition.ToNode?.NodeType == ProcessNodeType.EndArchived)
            {
                instance.Status = ProcessStatus.Finished;
            }
            else
            {
                instance.Status = ProcessStatus.InReview;
            }
        }
        else
        {
            instance.Status = ProcessStatus.InReview;
        }

        instance.UpdatedAt = DateTime.UtcNow;

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = previousNodeId,
            ToNodeId = instance.CurrentNodeId,
            Action = ProcessActionType.Advance,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = string.IsNullOrWhiteSpace(request.Observations) ? "Processo protocolado com sucesso." : request.Observations.Trim()
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessInstanceResponse> AdvanceAsync(Guid id, AdvanceProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleOrCreatorAsync(instance, user);

        var processType = await _processTypeRepository.GetCompleteTreeAsync(instance.ProcessTypeId)
            ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

        // Identificar próximo nodo
        var transitions = processType.Transitions
            .Where(t => t.FromNodeId == instance.CurrentNodeId && t.AllowAdvance)
            .ToList();

        if (transitions.Count == 0)
            throw new InvalidOperationException("Não existem transições de avanço permitidas a partir do local atual.");

        ProcessTransition transition;
        if (request.TargetNodeId.HasValue)
        {
            transition = transitions.FirstOrDefault(t => t.ToNodeId == request.TargetNodeId.Value)
                ?? throw new InvalidOperationException("A transição para o local de destino especificado não é permitida.");
        }
        else
        {
            transition = transitions.First();
        }

        // Atualizar valores de campos
        if (request.FieldValues != null)
        {
            foreach (var kvp in request.FieldValues)
            {
                var existing = instance.FieldValues.FirstOrDefault(f => f.FieldDefinitionId == kvp.Key);
                if (existing != null)
                {
                    existing.Value = kvp.Value;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _instanceRepository.AddFieldValue(new ProcessFieldValue
                    {
                        ProcessInstanceId = instance.Id,
                        FieldDefinitionId = kvp.Key,
                        Value = kvp.Value
                    });
                }
            }
        }

        var previousNodeId = instance.CurrentNodeId;
        instance.CurrentNodeId = transition.ToNodeId;
        instance.UpdatedAt = DateTime.UtcNow;

        if (transition.ToNode?.NodeType == ProcessNodeType.EndArchived)
        {
            instance.Status = ProcessStatus.Finished;
        }
        else
        {
            instance.Status = ProcessStatus.InReview;
        }

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = previousNodeId,
            ToNodeId = transition.ToNodeId,
            Action = ProcessActionType.Advance,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = string.IsNullOrWhiteSpace(request.Observations) ? "Processo avançado para a próxima etapa." : request.Observations.Trim()
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessInstanceResponse> ReturnAsync(Guid id, ReturnProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleAreaAsync(instance.AreaId, user);

        var processType = await _processTypeRepository.GetCompleteTreeAsync(instance.ProcessTypeId)
            ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

        var transitions = processType.Transitions
            .Where(t => t.ToNodeId == instance.CurrentNodeId && t.AllowReturn)
            .ToList();

        Guid targetNodeId;
        if (request.TargetNodeId.HasValue)
        {
            if (!transitions.Any(t => t.FromNodeId == request.TargetNodeId.Value))
                throw new InvalidOperationException("Não é permitido devolver para o local de destino especificado.");
            targetNodeId = request.TargetNodeId.Value;
        }
        else if (transitions.Count > 0)
        {
            targetNodeId = transitions.First().FromNodeId;
        }
        else if (processType.StartNodeId.HasValue)
        {
            targetNodeId = processType.StartNodeId.Value;
        }
        else
        {
            throw new InvalidOperationException("Não foi possível determinar o local de devolução.");
        }

        var previousNodeId = instance.CurrentNodeId;
        instance.CurrentNodeId = targetNodeId;
        instance.Status = ProcessStatus.Returned;
        instance.UpdatedAt = DateTime.UtcNow;

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = previousNodeId,
            ToNodeId = targetNodeId,
            Action = ProcessActionType.Return,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = request.Observations.Trim()
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessInstanceResponse> RestartAsync(Guid id, RestartProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleAreaAsync(instance.AreaId, user);

        var processType = await _processTypeRepository.GetCompleteTreeAsync(instance.ProcessTypeId)
            ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

        if (!processType.StartNodeId.HasValue)
            throw new InvalidOperationException("Ponto de partida da árvore não encontrado.");

        var previousNodeId = instance.CurrentNodeId;
        instance.CurrentNodeId = processType.StartNodeId.Value;
        instance.Status = ProcessStatus.Returned;
        instance.UpdatedAt = DateTime.UtcNow;

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = previousNodeId,
            ToNodeId = processType.StartNodeId.Value,
            Action = ProcessActionType.Restart,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = request.Observations.Trim()
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessInstanceResponse> AddCommentAsync(Guid id, AddProcessCommentRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        await ValidateInstanceViewAccessAsync(instance);

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = instance.CurrentNodeId,
            ToNodeId = instance.CurrentNodeId,
            Action = ProcessActionType.Comment,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = request.Observations.Trim()
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!);
    }

    private async Task<ApplicationUser> GetCurrentUserAsync()
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        return await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
    }

    private async Task ValidateAreaHandleAccessAsync(Guid areaId)
    {
        var user = await GetCurrentUserAsync();
        await ValidateCanHandleAreaAsync(areaId, user);
    }

    private async Task ValidateCanHandleAreaAsync(Guid areaId, ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(SystemRoles.SuperAdmin))
            return;

        var area = await _areaRepository.GetByIdAsync(areaId)
            ?? throw new KeyNotFoundException("Área não encontrada.");

        if (user.CompanyId != area.CompanyId)
            throw new UnauthorizedAccessException("Acesso negado às solicitações de outra empresa.");

        if (roles.Contains(SystemRoles.CompanyAdmin))
            return;

        var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
        var areaAccess = accesses.FirstOrDefault(a => a.AreaId == areaId && a.IsActive);

        if (areaAccess == null || (!areaAccess.CanHandleWorkflowRequests && !areaAccess.CanManage))
            throw new UnauthorizedAccessException("Você não possui permissão para tramitar processos desta área.");
    }

    private async Task ValidateCanHandleOrCreatorAsync(ProcessInstance instance, ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.CompanyAdmin))
            return;

        if (instance.CreatedByUserId == user.Id.ToString())
            return;

        await ValidateCanHandleAreaAsync(instance.AreaId, user);
    }

    private async Task ValidateInstanceViewAccessAsync(ProcessInstance instance)
    {
        var user = await GetCurrentUserAsync();
        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(SystemRoles.SuperAdmin))
            return;

        if (user.CompanyId != instance.CompanyId)
            throw new UnauthorizedAccessException("Acesso negado a processos de outra empresa.");

        if (roles.Contains(SystemRoles.CompanyAdmin) || instance.CreatedByUserId == user.Id.ToString())
            return;

        var isUnitUser = user.UnitId.HasValue && roles.Contains(SystemRoles.UnitUser);
        if (isUnitUser)
        {
            if (instance.OriginUnitId != user.UnitId)
            {
                throw new UnauthorizedAccessException("Usuários de unidade só podem visualizar processos abertos pela sua própria unidade.");
            }
            return;
        }

        var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
        var areaAccess = accesses.FirstOrDefault(a => a.AreaId == instance.AreaId && a.IsActive);

        if (areaAccess == null || (!areaAccess.CanView && !areaAccess.CanHandleWorkflowRequests && !areaAccess.CanManage))
            throw new UnauthorizedAccessException("Você não possui permissão para visualizar processos desta área.");
    }

    private static ProcessInstanceSummaryResponse MapToSummaryResponse(ProcessInstance p) => new()
    {
        Id = p.Id,
        ProcessNumber = p.ProcessNumber,
        Title = p.Title,
        ProcessTypeId = p.ProcessTypeId,
        ProcessTypeName = p.ProcessType?.Name ?? string.Empty,
        CurrentNodeId = p.CurrentNodeId,
        CurrentNodeName = p.CurrentNode?.Name ?? string.Empty,
        Status = p.Status,
        CreatedByUserId = p.CreatedByUserId,
        CreatedByUserName = p.CreatedByUserName,
        OriginUnitName = p.OriginUnit?.Name,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };

    private static ProcessInstanceResponse MapToCompleteResponse(ProcessInstance p) => new()
    {
        Id = p.Id,
        CompanyId = p.CompanyId,
        CompanyName = p.Company?.Name ?? string.Empty,
        AreaId = p.AreaId,
        AreaName = p.Area?.Name ?? string.Empty,
        ProcessTypeId = p.ProcessTypeId,
        ProcessTypeName = p.ProcessType?.Name ?? string.Empty,
        ProcessTypeVersion = p.ProcessType?.VersionNumber ?? 1,
        CurrentNodeId = p.CurrentNodeId,
        CurrentNodeName = p.CurrentNode?.Name ?? string.Empty,
        CurrentNodeType = p.CurrentNode?.NodeType ?? ProcessNodeType.StandardStage,
        ProcessNumber = p.ProcessNumber,
        Title = p.Title,
        Status = p.Status,
        CreatedByUserId = p.CreatedByUserId,
        CreatedByUserName = p.CreatedByUserName,
        OriginUnitId = p.OriginUnitId,
        OriginUnitName = p.OriginUnit?.Name,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        FieldValues = p.FieldValues.Select(fv => new ProcessFieldValueResponse
        {
            FieldDefinitionId = fv.FieldDefinitionId,
            Code = fv.FieldDefinition?.Code ?? string.Empty,
            Name = fv.FieldDefinition?.Name ?? string.Empty,
            Type = fv.FieldDefinition?.Type ?? FieldType.Text,
            Value = fv.Value
        }).ToList(),
        History = p.History.OrderByDescending(h => h.CreatedAt).Select(h => new ProcessHistoryResponse
        {
            Id = h.Id,
            FromNodeId = h.FromNodeId,
            FromNodeName = h.FromNode?.Name,
            ToNodeId = h.ToNodeId,
            ToNodeName = h.ToNode?.Name,
            Action = h.Action,
            UserId = h.UserId,
            UserFullName = h.UserFullName,
            Observations = h.Observations,
            CreatedAt = h.CreatedAt
        }).ToList()
    };
}

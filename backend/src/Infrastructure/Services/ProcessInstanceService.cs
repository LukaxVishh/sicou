using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;
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
    private readonly ApplicationDbContext _context;

    public ProcessInstanceService(
        IProcessInstanceRepository instanceRepository,
        IProcessTypeRepository processTypeRepository,
        IAreaRepository areaRepository,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IUserAreaAccessRepository userAreaAccessRepository,
        ApplicationDbContext context)
    {
        _instanceRepository = instanceRepository;
        _processTypeRepository = processTypeRepository;
        _areaRepository = areaRepository;
        _currentUser = currentUser;
        _userManager = userManager;
        _userAreaAccessRepository = userAreaAccessRepository;
        _context = context;
    }

    public async Task<IReadOnlyList<ProcessInstanceSummaryResponse>> GetAreaProcessesAsync(
        Guid areaId,
        ProcessStatus? status = null,
        ProcessSearchFilterRequest? filter = null)
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
                // Usuário de unidade visualiza os processos originados ou atualmente lotados na sua própria unidade
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

        var effectiveStatus = status ?? filter?.Status;
        var instances = await _instanceRepository.GetByAreaIdAsync(areaId, effectiveStatus, filterUnitId);
        var filtered = ApplySearchFilters(instances, filter);
        return filtered.Select(MapToSummaryResponse).ToList();
    }

    public async Task<IReadOnlyList<ProcessInstanceSummaryResponse>> SearchProcessesAsync(ProcessSearchFilterRequest filter)
    {
        if (filter.AreaId.HasValue)
        {
            return await GetAreaProcessesAsync(filter.AreaId.Value, filter.Status, filter);
        }

        var user = await GetCurrentUserAsync();
        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);
        var isCompanyAdmin = roles.Contains(SystemRoles.CompanyAdmin);

        IReadOnlyList<ProcessInstance> instances;
        if (user.CompanyId.HasValue)
        {
            Guid? unitRestriction = (!isSuperAdmin && !isCompanyAdmin && user.UnitId.HasValue && roles.Contains(SystemRoles.UnitUser))
                ? user.UnitId.Value
                : null;
            instances = await _instanceRepository.GetByCompanyIdAsync(user.CompanyId.Value, filter.Status, unitRestriction);
        }
        else if (isSuperAdmin)
        {
            instances = await _context.ProcessInstances
                .Include(x => x.Area)
                .Include(x => x.ProcessType)
                .Include(x => x.CurrentNode)
                .Include(x => x.OriginUnit)
                .Include(x => x.CurrentUnit)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }
        else
        {
            instances = await _instanceRepository.GetByUserIdAsync(user.Id.ToString());
        }

        var filtered = ApplySearchFilters(instances, filter);
        return filtered.Select(MapToSummaryResponse).ToList();
    }

    private static IEnumerable<ProcessInstance> ApplySearchFilters(
        IEnumerable<ProcessInstance> instances,
        ProcessSearchFilterRequest? filter)
    {
        if (filter == null)
            return instances;

        var query = instances;

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.Trim().TrimStart('#').ToLowerInvariant();
            query = query.Where(p =>
                (p.ProcessNumber != null && p.ProcessNumber.ToLowerInvariant().Contains(term)) ||
                (p.Title != null && p.Title.ToLowerInvariant().Contains(term)) ||
                (p.ProcessType?.Name != null && p.ProcessType.Name.ToLowerInvariant().Contains(term)) ||
                (p.CurrentNode?.Name != null && p.CurrentNode.Name.ToLowerInvariant().Contains(term)));
        }

        if (filter.UnitId.HasValue)
        {
            query = query.Where(p =>
                p.OriginUnitId == filter.UnitId.Value ||
                p.CurrentUnitId == filter.UnitId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.UnitName))
        {
            var unitTerm = filter.UnitName.Trim().ToLowerInvariant();
            query = query.Where(p =>
                (p.OriginUnit?.Name ?? "Sede da Empresa").ToLowerInvariant().Contains(unitTerm) ||
                (p.CurrentUnitName ?? p.CurrentUnit?.Name ?? p.OriginUnit?.Name ?? "Sede da Empresa").ToLowerInvariant().Contains(unitTerm));
        }

        if (filter.Status.HasValue)
        {
            query = query.Where(p => p.Status == filter.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Creator))
        {
            var creatorTerm = filter.Creator.Trim().ToLowerInvariant();
            query = query.Where(p =>
                (p.CreatedByUserName != null && p.CreatedByUserName.ToLowerInvariant().Contains(creatorTerm)) ||
                (p.OpenedByUserName != null && p.OpenedByUserName.ToLowerInvariant().Contains(creatorTerm)) ||
                p.CreatedByUserId.ToLowerInvariant() == creatorTerm ||
                (p.OpenedByUserId != null && p.OpenedByUserId.ToLowerInvariant() == creatorTerm));
        }

        if (filter.StartDate.HasValue)
        {
            var startDate = filter.StartDate.Value.Date;
            query = query.Where(p => (p.OpenedAt ?? p.CreatedAt).Date >= startDate);
        }

        if (filter.EndDate.HasValue)
        {
            var endDate = filter.EndDate.Value.Date;
            query = query.Where(p => (p.OpenedAt ?? p.CreatedAt).Date <= endDate);
        }

        return query;
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
        var canManipulate = !IsTerminalStatus(instance.Status) && await CheckCanManipulateAsync(instance.CurrentNodeId);
        return MapToCompleteResponse(instance, canManipulate);
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
        var originUnitId = request.OriginUnitId ?? user.UnitId;

        if (!isDraft)
        {
            ValidateRequiredNodeFields(
                processType,
                processType.StartNodeId.Value,
                Enumerable.Empty<ProcessFieldValue>(),
                request.InitialFieldValues,
                isRejectingTransition: false,
                observations: "Processo confeccionado e protocolado com sucesso.");
        }

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
            OpenedByUserId = isDraft ? null : user.Id.ToString(),
            OpenedByUserName = isDraft ? null : user.FullName,
            OpenedAt = isDraft ? null : DateTime.UtcNow,
            OriginUnitId = originUnitId,
            CurrentUnitId = originUnitId
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
        var canManipulateCreated = await CheckCanManipulateAsync(created!.CurrentNodeId);
        return MapToCompleteResponse(created!, canManipulateCreated);
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
            instance.CurrentUnitId ??= request.OriginUnitId.Value;
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
        var canManipulateUpdated = await CheckCanManipulateAsync(updated!.CurrentNodeId);
        return MapToCompleteResponse(updated!, canManipulateUpdated);
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

        var processType = await _processTypeRepository.GetCompleteTreeAsync(instance.ProcessTypeId)
            ?? throw new InvalidOperationException("Árvore de processo associada não encontrada.");

        // Validar campos obrigatórios configurados para o nó de confecção atual
        ValidateRequiredNodeFields(
            processType,
            instance.CurrentNodeId,
            instance.FieldValues,
            request.FieldValues,
            isRejectingTransition: false,
            observations: request.Observations);

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

        var previousNodeId = instance.CurrentNodeId;
        var transitions = processType.Transitions
            .Where(t => t.FromNodeId == instance.CurrentNodeId && t.AllowAdvance)
            .ToList();

        if (transitions.Count > 0)
        {
            var firstTransition = transitions.First();
            instance.CurrentNodeId = firstTransition.ToNodeId;
            instance.Status = ResolveStatusForNode(firstTransition.ToNode);
        }
        else
        {
            instance.Status = ProcessStatus.InReview;
        }

        // Registrar usuario_abertura e data de abertura
        instance.OpenedByUserId ??= user.Id.ToString();
        instance.OpenedByUserName ??= user.FullName;
        instance.OpenedAt ??= DateTime.UtcNow;
        instance.CurrentUnitId ??= instance.OriginUnitId ?? user.UnitId;
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
        var canManipulateUpdated = await CheckCanManipulateAsync(updated!.CurrentNodeId);
        return MapToCompleteResponse(updated!, canManipulateUpdated);
    }

    public async Task<ProcessInstanceResponse> AdvanceAsync(Guid id, AdvanceProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível tramitar um processo que já foi concluído ou cancelado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleOrCreatorAsync(instance, user);
        await ValidateNodeManipulationAccessAsync(instance.CurrentNodeId, user);

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

        var nextStatus = ResolveStatusForNode(transition.ToNode);
        var isRejectingTransition = nextStatus == ProcessStatus.Rejected;

        // Validar campos obrigatórios da etapa atual antes de permitir a transição
        ValidateRequiredNodeFields(
            processType,
            instance.CurrentNodeId,
            instance.FieldValues,
            request.FieldValues,
            isRejectingTransition,
            request.Observations);

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
        instance.Status = nextStatus;

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
        var canManipulateAfter = !IsTerminalStatus(updated!.Status) && await CheckCanManipulateAsync(updated.CurrentNodeId);
        return MapToCompleteResponse(updated, canManipulateAfter);
    }

    public async Task<ProcessInstanceResponse> ReturnAsync(Guid id, ReturnProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível devolver um processo que já foi concluído ou cancelado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleAreaAsync(instance.AreaId, user);
        await ValidateNodeManipulationAccessAsync(instance.CurrentNodeId, user);

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
        var canManipulateAfter = await CheckCanManipulateAsync(updated!.CurrentNodeId);
        return MapToCompleteResponse(updated!, canManipulateAfter);
    }

    public async Task<ProcessInstanceResponse> RestartAsync(Guid id, RestartProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível reiniciar um processo que já foi concluído ou cancelado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleAreaAsync(instance.AreaId, user);
        await ValidateNodeManipulationAccessAsync(instance.CurrentNodeId, user);

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
        var canManipulateAfter = await CheckCanManipulateAsync(updated!.CurrentNodeId);
        return MapToCompleteResponse(updated!, canManipulateAfter);
    }

    public async Task<ProcessInstanceResponse> AddCommentAsync(Guid id, AddProcessCommentRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível adicionar parecer em um processo que já foi concluído ou cancelado.");

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
        var canManipulateAfter = await CheckCanManipulateAsync(updated!.CurrentNodeId);
        return MapToCompleteResponse(updated!, canManipulateAfter);
    }

    public async Task<ProcessInstanceResponse> CancelAsync(Guid id, CancelProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        var user = await GetCurrentUserAsync();
        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);
        var isCompanyAdmin = roles.Contains(SystemRoles.CompanyAdmin);

        if (!isSuperAdmin && user.CompanyId != instance.CompanyId)
            throw new UnauthorizedAccessException("Acesso negado a processos de outra empresa.");

        var isCreator = instance.CreatedByUserId == user.Id.ToString();
        var isAreaAdmin = false;
        if (!isSuperAdmin && !isCompanyAdmin)
        {
            var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
            var areaAccess = accesses.FirstOrDefault(a => a.AreaId == instance.AreaId && a.IsActive);
            isAreaAdmin = areaAccess != null && (areaAccess.CanManage || areaAccess.CanManageWorkflows);
        }

        if (!isSuperAdmin && !isCompanyAdmin && !isCreator && !isAreaAdmin)
        {
            throw new UnauthorizedAccessException("Apenas o autor do processo ou administradores da respectiva área possuem permissão para realizar o cancelamento administrativo.");
        }

        if (instance.Status == ProcessStatus.AdministrativeCancellation)
            throw new InvalidOperationException("Este processo já se encontra cancelado administrativamente.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível cancelar um processo que já atingiu um estado de conclusão final.");

        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5)
            throw new InvalidOperationException("A justificativa do cancelamento é obrigatória e deve conter pelo menos 5 caracteres.");

        var currentNodeId = instance.CurrentNodeId;
        instance.Status = ProcessStatus.AdministrativeCancellation;
        instance.UpdatedAt = DateTime.UtcNow;

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = currentNodeId,
            ToNodeId = currentNodeId,
            Action = ProcessActionType.Cancel,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = $"Cancelamento Administrativo: {request.Reason.Trim()}"
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        return MapToCompleteResponse(updated!, false);
    }

    public async Task<ProcessInstanceResponse> TransferAsync(Guid id, TransferProcessRequest request)
    {
        var instance = await _instanceRepository.GetCompleteInstanceAsync(id)
            ?? throw new KeyNotFoundException("Processo não encontrado.");

        if (IsTerminalStatus(instance.Status))
            throw new InvalidOperationException("Não é possível transferir um processo que já foi concluído ou cancelado.");

        var user = await GetCurrentUserAsync();
        await ValidateCanHandleOrCreatorAsync(instance, user);

        if (string.IsNullOrWhiteSpace(request.Observations) || request.Observations.Trim().Length < 5)
            throw new InvalidOperationException("O motivo / justificativa da transferência é obrigatório (mínimo de 5 caracteres).");

        var previousUnitId = instance.CurrentUnitId ?? instance.OriginUnitId;
        var previousUnitName = !string.IsNullOrWhiteSpace(instance.CurrentUnitName)
            ? instance.CurrentUnitName
            : (instance.CurrentUnit?.Name ?? instance.OriginUnit?.Name ?? (instance.Area != null ? $"Sede - {instance.Area.Name}" : "Sede da Empresa"));

        Guid? newUnitId = null;
        string newUnitName;

        if (request.DestinationUnitId.HasValue)
        {
            var targetUnit = await _context.Units
                .FirstOrDefaultAsync(u => u.Id == request.DestinationUnitId.Value && u.CompanyId == instance.CompanyId && u.IsActive)
                ?? throw new KeyNotFoundException("Unidade de destino não encontrada ou inativa nesta empresa.");

            newUnitId = targetUnit.Id;
            newUnitName = targetUnit.Name;
        }
        else if (!string.IsNullOrWhiteSpace(request.DestinationUnitName))
        {
            var trimmedName = request.DestinationUnitName.Trim();
            var matchedUnit = await _context.Units
                .FirstOrDefaultAsync(u => u.CompanyId == instance.CompanyId && u.IsActive && u.Name.ToLower() == trimmedName.ToLower());

            newUnitId = matchedUnit?.Id;
            newUnitName = matchedUnit?.Name ?? trimmedName;
        }
        else
        {
            throw new InvalidOperationException("Selecione ou informe a unidade de destino para realizar a transferência.");
        }

        if ((newUnitId.HasValue && previousUnitId.HasValue && newUnitId.Value == previousUnitId.Value) ||
            string.Equals(previousUnitName, newUnitName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"O processo já se encontra lotado na unidade/departamento '{newUnitName}'.");
        }

        // Atualiza a lotação/unidade corrente mantendo o nó e o status atuais intactos
        instance.CurrentUnitId = newUnitId;
        instance.CurrentUnitName = newUnitName;
        instance.UpdatedAt = DateTime.UtcNow;

        _instanceRepository.AddHistory(new ProcessHistory
        {
            ProcessInstanceId = instance.Id,
            FromNodeId = instance.CurrentNodeId,
            ToNodeId = instance.CurrentNodeId,
            FromUnitId = previousUnitId,
            FromUnitName = previousUnitName,
            ToUnitId = newUnitId,
            ToUnitName = newUnitName,
            Action = ProcessActionType.Transfer,
            UserId = user.Id.ToString(),
            UserFullName = user.FullName,
            Observations = $"Transferência de unidade ({previousUnitName} → {newUnitName}): {request.Observations.Trim()}"
        });

        await _instanceRepository.SaveChangesAsync();

        var updated = await _instanceRepository.GetCompleteInstanceAsync(id);
        var canManipulateAfter = !IsTerminalStatus(updated!.Status) && await CheckCanManipulateAsync(updated.CurrentNodeId);
        return MapToCompleteResponse(updated, canManipulateAfter);
    }

    private static void ValidateRequiredNodeFields(
        ProcessType processType,
        Guid nodeId,
        IEnumerable<ProcessFieldValue> existingValues,
        Dictionary<Guid, string?>? incomingValues,
        bool isRejectingTransition,
        string? observations)
    {
        var merged = new Dictionary<Guid, string?>();
        foreach (var fv in existingValues)
        {
            merged[fv.FieldDefinitionId] = fv.Value;
        }

        if (incomingValues != null)
        {
            foreach (var kvp in incomingValues)
            {
                merged[kvp.Key] = kvp.Value;
            }
        }

        if (isRejectingTransition)
        {
            var hasRejectionReasonField = processType.Fields
                .Where(f => f.IsActive && f.FieldDefinition != null &&
                            (f.FieldDefinition.Code.Contains("rejeicao") || f.FieldDefinition.Code.Contains("indefer")))
                .Any(f => merged.TryGetValue(f.FieldDefinitionId, out var v) && !string.IsNullOrWhiteSpace(v));

            if (!hasRejectionReasonField && string.IsNullOrWhiteSpace(observations))
            {
                throw new InvalidOperationException("Para reprovar ou indeferir a solicitação, é obrigatório informar a justificativa ou o motivo da rejeição.");
            }
            return;
        }

        var requiredFieldsForNode = processType.Fields
            .Where(f => f.ProcessNodeId == nodeId && f.IsActive && f.IsRequired)
            .OrderBy(f => f.DisplayOrder)
            .ToList();

        foreach (var reqField in requiredFieldsForNode)
        {
            if (!merged.TryGetValue(reqField.FieldDefinitionId, out var val) || string.IsNullOrWhiteSpace(val))
            {
                var fieldLabel = !string.IsNullOrWhiteSpace(reqField.CustomLabel)
                    ? reqField.CustomLabel
                    : (reqField.FieldDefinition?.Name ?? "Campo obrigatório");
                throw new InvalidOperationException($"O campo obrigatório '{fieldLabel}' deve ser preenchido para concluir esta etapa.");
            }
        }
    }

    private static bool IsTerminalStatus(ProcessStatus status) =>
        status is ProcessStatus.Approved or ProcessStatus.Rejected or ProcessStatus.Finished or ProcessStatus.AdministrativeCancellation;

    private static ProcessStatus ResolveStatusForNode(ProcessNode? node)
    {
        if (node == null)
            return ProcessStatus.InReview;

        if (node.NodeType == ProcessNodeType.EndApproved)
            return ProcessStatus.Approved;

        if (node.NodeType == ProcessNodeType.EndRejected)
            return ProcessStatus.Rejected;

        if (node.NodeType == ProcessNodeType.EndArchived)
            return ProcessStatus.Finished;

        var normalizedName = (node.Name ?? string.Empty).ToLowerInvariant();
        if (normalizedName.Contains("deferid") && !normalizedName.Contains("indeferid"))
            return ProcessStatus.Approved;

        if (normalizedName.Contains("indeferid"))
            return ProcessStatus.Rejected;

        return ProcessStatus.InReview;
    }

    private async Task ValidateNodeManipulationAccessAsync(Guid nodeId, ApplicationUser user)
    {
        var hasNodeAccess = await _context.UserProcessNodes
            .AnyAsync(upn => upn.UserId == user.Id.ToString() && upn.ProcessNodeId == nodeId && upn.IsActive);

        if (!hasNodeAccess)
        {
            throw new UnauthorizedAccessException("Você não possui o local de processo desta etapa atribuído ao seu perfil para manipular este processo.");
        }
    }

    private async Task<bool> CheckCanManipulateAsync(Guid nodeId)
    {
        var currentUserId = _currentUser.UserId;
        if (string.IsNullOrEmpty(currentUserId))
            return false;

        return await _context.UserProcessNodes
            .AnyAsync(upn => upn.UserId == currentUserId && upn.ProcessNodeId == nodeId && upn.IsActive);
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
            if (instance.OriginUnitId != user.UnitId && instance.CurrentUnitId != user.UnitId)
            {
                throw new UnauthorizedAccessException("Usuários de unidade só podem visualizar processos originados ou lotados na sua própria unidade.");
            }
            return;
        }

        var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
        var areaAccess = accesses.FirstOrDefault(a => a.AreaId == instance.AreaId && a.IsActive);

        if (areaAccess == null || (!areaAccess.CanView && !areaAccess.CanHandleWorkflowRequests && !areaAccess.CanManage))
            throw new UnauthorizedAccessException("Você não possui permissão para visualizar processos desta área.");
    }

    private static ProcessInstanceSummaryResponse MapToSummaryResponse(ProcessInstance p)
    {
        var originUnitName = p.OriginUnit?.Name ?? "Sede da Empresa";
        var currentUnitName = !string.IsNullOrWhiteSpace(p.CurrentUnitName)
            ? p.CurrentUnitName
            : (p.CurrentUnit?.Name ?? originUnitName);
        var destinationUnitName = !string.IsNullOrWhiteSpace(p.CurrentUnitName)
            ? p.CurrentUnitName
            : (p.CurrentUnit?.Name ?? (p.Area != null ? $"Sede - {p.Area.Name}" : originUnitName));

        return new ProcessInstanceSummaryResponse
        {
            Id = p.Id,
            AreaId = p.AreaId,
            AreaName = p.Area?.Name ?? string.Empty,
            ProcessNumber = p.ProcessNumber,
            Title = p.Title,
            ProcessTypeId = p.ProcessTypeId,
            ProcessTypeName = p.ProcessType?.Name ?? string.Empty,
            CurrentNodeId = p.CurrentNodeId,
            CurrentNodeName = p.CurrentNode?.Name ?? string.Empty,
            Status = p.Status,
            CreatedByUserId = p.CreatedByUserId,
            CreatedByUserName = p.CreatedByUserName,
            OpenedByUserId = p.OpenedByUserId,
            OpenedByUserName = p.OpenedByUserName ?? (p.Status == ProcessStatus.Draft ? null : p.CreatedByUserName),
            OpenedAt = p.OpenedAt ?? (p.Status == ProcessStatus.Draft ? null : p.CreatedAt),
            OriginUnitId = p.OriginUnitId,
            OriginUnitName = originUnitName,
            CurrentUnitId = p.CurrentUnitId ?? p.OriginUnitId,
            CurrentUnitName = currentUnitName,
            DestinationUnitName = destinationUnitName,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt
        };
    }

    private static ProcessInstanceResponse MapToCompleteResponse(ProcessInstance p, bool canManipulate = false)
    {
        var openEvent = p.History
            .OrderBy(h => h.CreatedAt)
            .FirstOrDefault(h => h.Action == ProcessActionType.Advance);

        DateTime? openedAt = p.OpenedAt ?? (p.Status == ProcessStatus.Draft ? null : (openEvent?.CreatedAt ?? p.CreatedAt));
        string? openedByUserId = p.OpenedByUserId ?? (p.Status == ProcessStatus.Draft ? null : (openEvent?.UserId ?? p.CreatedByUserId));
        string? openedByUserName = p.OpenedByUserName ?? (p.Status == ProcessStatus.Draft ? null : (openEvent?.UserFullName ?? p.CreatedByUserName));
        string originUnitName = p.OriginUnit?.Name ?? "Sede da Empresa";
        string? openedByUnitName = p.Status == ProcessStatus.Draft ? null : originUnitName;
        string currentUnitName = !string.IsNullOrWhiteSpace(p.CurrentUnitName)
            ? p.CurrentUnitName
            : (p.CurrentUnit?.Name ?? originUnitName);
        string destinationUnitName = !string.IsNullOrWhiteSpace(p.CurrentUnitName)
            ? p.CurrentUnitName
            : (p.CurrentUnit?.Name ?? (p.Area != null ? $"Sede - {p.Area.Name}" : "Sede da Empresa"));

        return new ProcessInstanceResponse
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
            OriginUnitName = originUnitName,
            CurrentUnitId = p.CurrentUnitId ?? p.OriginUnitId,
            CurrentUnitName = currentUnitName,
            OpenedAt = openedAt,
            OpenedByUserId = openedByUserId,
            OpenedByUserName = openedByUserName,
            OpenedByUnitName = openedByUnitName,
            DestinationUnitName = destinationUnitName,
            CanManipulate = canManipulate,
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
                FromUnitId = h.FromUnitId,
                FromUnitName = h.FromUnitName,
                ToUnitId = h.ToUnitId,
                ToUnitName = h.ToUnitName,
                Action = h.Action,
                UserId = h.UserId,
                UserFullName = h.UserFullName,
                Observations = h.Observations,
                CreatedAt = h.CreatedAt
            }).ToList()
        };
    }
}

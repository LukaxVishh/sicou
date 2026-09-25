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

public class ProcessTypeService : IProcessTypeService
{
    private readonly IProcessTypeRepository _processTypeRepository;
    private readonly IAreaRepository _areaRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserAreaAccessRepository _userAreaAccessRepository;

    public ProcessTypeService(
        IProcessTypeRepository processTypeRepository,
        IAreaRepository areaRepository,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IUserAreaAccessRepository userAreaAccessRepository)
    {
        _processTypeRepository = processTypeRepository;
        _areaRepository = areaRepository;
        _currentUser = currentUser;
        _userManager = userManager;
        _userAreaAccessRepository = userAreaAccessRepository;
    }

    public async Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetByAreaIdAsync(Guid areaId)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: false);
        var types = await _processTypeRepository.GetByAreaIdAsync(areaId);
        return types.Select(MapToSummaryResponse).ToList();
    }

    public async Task<ProcessTypeResponse> GetByIdAsync(Guid id)
    {
        var type = await _processTypeRepository.GetCompleteTreeAsync(id)
            ?? throw new KeyNotFoundException($"Tipo de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(type.AreaId, requireManage: false);
        return MapToCompleteResponse(type);
    }

    public async Task<IReadOnlyList<ProcessTypeSummaryResponse>> GetAvailableForOpeningAsync()
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Contains(SystemRoles.SuperAdmin);

        if (!user.CompanyId.HasValue && !isSuperAdmin)
            throw new InvalidOperationException("Usuário não está vinculado a uma empresa.");

        ProcessAudience? audience = isSuperAdmin ? null : (user.UnitId.HasValue ? ProcessAudience.UnitsOnly : ProcessAudience.HeadquartersOnly);
        var available = await _processTypeRepository.GetAvailableForAudienceAsync(user.CompanyId, audience);

        return available.Select(MapToSummaryResponse).ToList();
    }

    public async Task<ProcessTypeResponse> CreateAsync(Guid areaId, CreateProcessTypeRequest request)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: true);

        var code = request.Code.Trim().ToUpperInvariant();
        if (await _processTypeRepository.ExistsByCodeAsync(areaId, code))
            throw new InvalidOperationException($"Já existe um tipo de processo com o código '{code}' nesta área.");

        var processType = new ProcessType
        {
            AreaId = areaId,
            FamilyId = Guid.NewGuid(),
            VersionNumber = 1,
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            TargetAudience = request.TargetAudience,
            Status = ProcessTypeStatus.Draft,
            StartNodeId = request.StartNodeId
        };

        await _processTypeRepository.AddAsync(processType);
        await _processTypeRepository.SaveChangesAsync();

        var created = await _processTypeRepository.GetCompleteTreeAsync(processType.Id);
        return MapToCompleteResponse(created!);
    }

    public async Task<ProcessTypeResponse> UpdateAsync(Guid id, UpdateProcessTypeRequest request)
    {
        var processType = await _processTypeRepository.GetCompleteTreeAsync(id)
            ?? throw new KeyNotFoundException($"Tipo de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(processType.AreaId, requireManage: true);

        if (processType.Status != ProcessTypeStatus.Draft)
            throw new InvalidOperationException("Apenas árvores em estado de Rascunho (Draft) podem ser editadas diretamente. Para alterar uma árvore homologada, crie uma Nova Versão.");

        processType.Name = request.Name.Trim();
        processType.Description = request.Description?.Trim();
        processType.TargetAudience = request.TargetAudience;
        processType.StartNodeId = request.StartNodeId;
        processType.UpdatedAt = DateTime.UtcNow;

        // Atualizar Nodos
        if (processType.Nodes.Count > 0)
        {
            _processTypeRepository.RemoveNodes(processType.Nodes.ToList());
        }

        var newNodes = request.Nodes.Select(n => new ProcessTypeNode
        {
            ProcessTypeId = processType.Id,
            ProcessNodeId = n.ProcessNodeId,
            Order = n.Order,
            Instructions = n.Instructions?.Trim()
        }).ToList();
        _processTypeRepository.AddNodes(newNodes);

        // Atualizar Campos
        if (processType.Fields.Count > 0)
        {
            _processTypeRepository.RemoveFields(processType.Fields.ToList());
        }

        var newFields = request.Fields.Select(f => new ProcessTypeField
        {
            ProcessTypeId = processType.Id,
            FieldDefinitionId = f.FieldDefinitionId,
            ProcessNodeId = f.ProcessNodeId,
            IsRequired = f.IsRequired,
            DisplayOrder = f.DisplayOrder,
            CustomLabel = f.CustomLabel?.Trim(),
            HelpText = f.HelpText?.Trim(),
            ConditionsJson = f.ConditionsJson
        }).ToList();
        _processTypeRepository.AddFields(newFields);

        // Atualizar Transições
        if (processType.Transitions.Count > 0)
        {
            _processTypeRepository.RemoveTransitions(processType.Transitions.ToList());
        }

        var newTransitions = request.Transitions.Select(t => new ProcessTransition
        {
            ProcessTypeId = processType.Id,
            FromNodeId = t.FromNodeId,
            ToNodeId = t.ToNodeId,
            AllowAdvance = t.AllowAdvance,
            AllowReturn = t.AllowReturn,
            AllowRestart = t.AllowRestart
        }).ToList();
        _processTypeRepository.AddTransitions(newTransitions);

        await _processTypeRepository.SaveChangesAsync();

        var updated = await _processTypeRepository.GetCompleteTreeAsync(id);
        return MapToCompleteResponse(updated!);
    }

    public async Task<ProcessTypeResponse> CloneToNewVersionAsync(Guid id)
    {
        var original = await _processTypeRepository.GetCompleteTreeAsync(id)
            ?? throw new KeyNotFoundException($"Tipo de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(original.AreaId, requireManage: true);

        if (original.Status != ProcessTypeStatus.Homologated)
            throw new InvalidOperationException("Apenas árvores homologadas podem ser clonadas para uma nova versão.");

        var newVersion = new ProcessType
        {
            AreaId = original.AreaId,
            FamilyId = original.FamilyId,
            VersionNumber = original.VersionNumber + 1,
            Code = original.Code,
            Name = original.Name,
            Description = original.Description,
            TargetAudience = original.TargetAudience,
            Status = ProcessTypeStatus.Draft,
            StartNodeId = original.StartNodeId,
            Nodes = original.Nodes.Select(n => new ProcessTypeNode
            {
                ProcessNodeId = n.ProcessNodeId,
                Order = n.Order,
                Instructions = n.Instructions
            }).ToList(),
            Fields = original.Fields.Select(f => new ProcessTypeField
            {
                FieldDefinitionId = f.FieldDefinitionId,
                ProcessNodeId = f.ProcessNodeId,
                IsRequired = f.IsRequired,
                DisplayOrder = f.DisplayOrder,
                CustomLabel = f.CustomLabel,
                HelpText = f.HelpText,
                ConditionsJson = f.ConditionsJson
            }).ToList(),
            Transitions = original.Transitions.Select(t => new ProcessTransition
            {
                FromNodeId = t.FromNodeId,
                ToNodeId = t.ToNodeId,
                AllowAdvance = t.AllowAdvance,
                AllowReturn = t.AllowReturn,
                AllowRestart = t.AllowRestart
            }).ToList()
        };

        await _processTypeRepository.AddAsync(newVersion);
        await _processTypeRepository.SaveChangesAsync();

        var created = await _processTypeRepository.GetCompleteTreeAsync(newVersion.Id);
        return MapToCompleteResponse(created!);
    }

    public async Task<ProcessTypeResponse> HomologateAsync(Guid id)
    {
        var processType = await _processTypeRepository.GetCompleteTreeAsync(id)
            ?? throw new KeyNotFoundException($"Tipo de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(processType.AreaId, requireManage: true);

        if (processType.Status != ProcessTypeStatus.Draft)
            throw new InvalidOperationException("Apenas árvores em Rascunho podem ser homologadas.");

        // Validação de Integridade do Grafo antes de homologar
        if (!processType.StartNodeId.HasValue)
            throw new InvalidOperationException("A árvore precisa possuir um Ponto de Partida / Nodo de Confecção definido.");

        if (processType.Nodes.Count < 2)
            throw new InvalidOperationException("A árvore precisa possuir pelo menos dois locais de processo configurados (início e destino/conclusão).");

        if (processType.Transitions.Count == 0)
            throw new InvalidOperationException("A árvore precisa possuir pelo menos uma transição de avanço configurada entre os locais.");

        // Arquivar versão homologada anterior da mesma família, se houver
        var previousHomologated = await _processTypeRepository.GetLatestHomologatedByFamilyIdAsync(processType.FamilyId);
        if (previousHomologated != null && previousHomologated.Id != processType.Id)
        {
            previousHomologated.Status = ProcessTypeStatus.Archived;
            previousHomologated.UpdatedAt = DateTime.UtcNow;
            _processTypeRepository.Update(previousHomologated);
        }

        processType.Status = ProcessTypeStatus.Homologated;
        processType.UpdatedAt = DateTime.UtcNow;
        _processTypeRepository.Update(processType);

        await _processTypeRepository.SaveChangesAsync();

        var homologated = await _processTypeRepository.GetCompleteTreeAsync(id);
        return MapToCompleteResponse(homologated!);
    }

    public async Task DeleteAsync(Guid id)
    {
        var processType = await _processTypeRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Tipo de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(processType.AreaId, requireManage: true);

        processType.IsActive = false;
        processType.UpdatedAt = DateTime.UtcNow;

        _processTypeRepository.Update(processType);
        await _processTypeRepository.SaveChangesAsync();
    }

    private async Task ValidateAreaAccessAsync(Guid areaId, bool requireManage)
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(SystemRoles.SuperAdmin))
            return;

        var area = await _areaRepository.GetByIdAsync(areaId)
            ?? throw new KeyNotFoundException("Área não encontrada.");

        if (user.CompanyId != area.CompanyId)
            throw new UnauthorizedAccessException("Você não possui permissão para acessar áreas de outra empresa.");

        if (roles.Contains(SystemRoles.CompanyAdmin))
            return;

        if (requireManage)
        {
            var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
            var areaAccess = accesses.FirstOrDefault(a => a.AreaId == areaId && a.IsActive);

            if (areaAccess == null || (!areaAccess.CanManageWorkflows && !areaAccess.CanManage))
                throw new UnauthorizedAccessException("Você não possui permissão para gerenciar fluxos ou árvores desta área.");
        }
    }

    private static ProcessTypeSummaryResponse MapToSummaryResponse(ProcessType p) => new()
    {
        Id = p.Id,
        AreaId = p.AreaId,
        AreaName = p.Area?.Name ?? string.Empty,
        FamilyId = p.FamilyId,
        VersionNumber = p.VersionNumber,
        Code = p.Code,
        Name = p.Name,
        Description = p.Description,
        TargetAudience = p.TargetAudience,
        Status = p.Status,
        NodesCount = p.Nodes.Count,
        FieldsCount = p.Fields.Count,
        CreatedAt = p.CreatedAt
    };

    private static ProcessTypeResponse MapToCompleteResponse(ProcessType p) => new()
    {
        Id = p.Id,
        AreaId = p.AreaId,
        AreaName = p.Area?.Name ?? string.Empty,
        FamilyId = p.FamilyId,
        VersionNumber = p.VersionNumber,
        Code = p.Code,
        Name = p.Name,
        Description = p.Description,
        TargetAudience = p.TargetAudience,
        Status = p.Status,
        StartNodeId = p.StartNodeId,
        StartNodeName = p.StartNode?.Name,
        IsActive = p.IsActive,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        Nodes = p.Nodes.OrderBy(n => n.Order).Select(n => new ProcessTypeNodeResponse
        {
            Id = n.Id,
            ProcessNodeId = n.ProcessNodeId,
            Code = n.ProcessNode?.Code ?? string.Empty,
            Name = n.ProcessNode?.Name ?? string.Empty,
            NodeType = n.ProcessNode?.NodeType ?? ProcessNodeType.StandardStage,
            Order = n.Order,
            Instructions = n.Instructions
        }).ToList(),
        Fields = p.Fields.OrderBy(f => f.DisplayOrder).Select(f => new ProcessTypeFieldResponse
        {
            Id = f.Id,
            ProcessNodeId = f.ProcessNodeId,
            ProcessNodeName = f.ProcessNode?.Name,
            FieldDefinitionId = f.FieldDefinitionId,
            Code = f.FieldDefinition?.Code ?? string.Empty,
            Name = f.FieldDefinition?.Name ?? string.Empty,
            Type = f.FieldDefinition?.Type ?? FieldType.Text,
            Placeholder = f.FieldDefinition?.Placeholder,
            GlobalOptionsJson = f.FieldDefinition?.GlobalOptionsJson,
            IsRequired = f.IsRequired,
            DisplayOrder = f.DisplayOrder,
            CustomLabel = f.CustomLabel,
            HelpText = f.HelpText,
            ConditionsJson = f.ConditionsJson
        }).ToList(),
        Transitions = p.Transitions.Select(t => new ProcessTransitionResponse
        {
            Id = t.Id,
            FromNodeId = t.FromNodeId,
            FromNodeName = t.FromNode?.Name ?? string.Empty,
            ToNodeId = t.ToNodeId,
            ToNodeName = t.ToNode?.Name ?? string.Empty,
            AllowAdvance = t.AllowAdvance,
            AllowReturn = t.AllowReturn,
            AllowRestart = t.AllowRestart
        }).ToList()
    };
}

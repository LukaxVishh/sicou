using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class ProcessNodeService : IProcessNodeService
{
    private readonly IProcessNodeRepository _nodeRepository;
    private readonly IAreaRepository _areaRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserAreaAccessRepository _userAreaAccessRepository;

    public ProcessNodeService(
        IProcessNodeRepository nodeRepository,
        IAreaRepository areaRepository,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IUserAreaAccessRepository userAreaAccessRepository)
    {
        _nodeRepository = nodeRepository;
        _areaRepository = areaRepository;
        _currentUser = currentUser;
        _userManager = userManager;
        _userAreaAccessRepository = userAreaAccessRepository;
    }

    public async Task<IReadOnlyList<ProcessNodeResponse>> GetByAreaIdAsync(Guid areaId)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: false);
        var nodes = await _nodeRepository.GetByAreaIdAsync(areaId);
        return nodes.Select(MapToResponse).ToList();
    }

    public async Task<ProcessNodeResponse> GetByIdAsync(Guid id)
    {
        var node = await _nodeRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Local de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(node.AreaId, requireManage: false);
        return MapToResponse(node);
    }

    public async Task<ProcessNodeResponse> CreateAsync(Guid areaId, CreateProcessNodeRequest request)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: true);

        var code = request.Code.Trim().ToLowerInvariant();
        if (await _nodeRepository.ExistsByCodeAsync(areaId, code))
            throw new InvalidOperationException($"Já existe um local de processo com o código '{code}' nesta área.");

        var node = new ProcessNode
        {
            AreaId = areaId,
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            NodeType = request.NodeType
        };

        await _nodeRepository.AddAsync(node);
        await _nodeRepository.SaveChangesAsync();

        return MapToResponse(node);
    }

    public async Task<ProcessNodeResponse> UpdateAsync(Guid id, UpdateProcessNodeRequest request)
    {
        var node = await _nodeRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Local de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(node.AreaId, requireManage: true);

        node.Name = request.Name.Trim();
        node.Description = request.Description?.Trim();
        node.NodeType = request.NodeType;
        node.IsActive = request.IsActive;
        node.UpdatedAt = DateTime.UtcNow;

        _nodeRepository.Update(node);
        await _nodeRepository.SaveChangesAsync();

        return MapToResponse(node);
    }

    public async Task DeleteAsync(Guid id)
    {
        var node = await _nodeRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Local de processo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(node.AreaId, requireManage: true);

        node.IsActive = false;
        node.UpdatedAt = DateTime.UtcNow;

        _nodeRepository.Update(node);
        await _nodeRepository.SaveChangesAsync();
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
                throw new UnauthorizedAccessException("Você não possui permissão para gerenciar fluxos ou locais desta área.");
        }
    }

    private static ProcessNodeResponse MapToResponse(ProcessNode n) => new()
    {
        Id = n.Id,
        AreaId = n.AreaId,
        Code = n.Code,
        Name = n.Name,
        Description = n.Description,
        NodeType = n.NodeType,
        IsActive = n.IsActive,
        CreatedAt = n.CreatedAt
    };
}
